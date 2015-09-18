'use strict';

/* Directives */

angular.module('jscalcDirectives', [])
  .directive('jscalcCalc', [
    '$mdToast',
    'DEFAULTS',
    'INPUT_TYPES',
    'OUTPUT_TYPES',
    '$location',
    '$timeout',
    'jscalcDateInput',
    '$filter',
    function($mdToast, DEFAULTS, INPUT_TYPES, OUTPUT_TYPES, $location, $timeout, jscalcDateInput,
        $filter) {
      return {
        restrict: 'E',
        templateUrl: '/partials/calc',
        scope: {
          doc: '=',
          inputs: '=',
          defaults: '=',
          editMode: '=',
          addInput: '&?',
          addOutput: '&?',
          configureInput: '&?',
          deleteInput: '&?',
          configureOutput: '&?',
          deleteOutput: '&?',
          gotoLine: '&?',
          // Suspends refreshing of web worker on script change.
          isActive: '&?',
          focusFirstInput: '&?'
        },
        link: function($scope, element, attr) {
          $scope.DEFAULTS = DEFAULTS;
          $scope.INPUT_TYPES = INPUT_TYPES;
          $scope.NESTED_INPUT_TYPES = angular.copy(INPUT_TYPES);
          _.remove($scope.NESTED_INPUT_TYPES, {type: 'list'});
          $scope.OUTPUT_TYPES = OUTPUT_TYPES;
          // Either an object {blobUrl: <URL for the blob containing worker
          // script>}, or if due to browser limitations using blobUrl is
          // impossible (useEval = true), an object containing the script to be
          // passed to eval() inside the worker: {script: <...>}.
          var workerConfig;
          var useEval = (navigator.userAgent.indexOf('MSIE') !== -1 ||
              navigator.appVersion.indexOf('Trident/') > 0);
          var worker = null;
          $scope.workerBuzy = false;
          $scope.workerError = null;
          $scope.debugMode = false;
          $scope.initialRunCompleted = false;
          var recalculationScheduled = false;
          var calculationTimeoutPromise = null;
          // Set to true while asleep (isActive retuns false) if script has to
          // be refreshed on waking.
          var workerDirty = false;
          // Whether it's possible to use debugger statement. Chrome or IE11.
          $scope.debugSupported = (/Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor)) ||
                (navigator.appVersion.indexOf('Trident/') > 0);

          angular.copy($scope.defaults || $scope.doc.defaults || {}, $scope.inputs);

          if (!('metaInputs' in $scope.doc)) {
            $scope.doc.metaInputs = [];
          }

          if (!('metaOutputs' in $scope.doc)) {
            $scope.doc.metaOutputs = [];
          }

          var convertInputs = function(inputs, metaInputs) {
            var convertedInputs = {};
            _.forEach(metaInputs, function(metaInput) {
              if (metaInput.name in convertedInputs) {
                throw {name: 'JscalcNameConflictError',
                    message: metaInput.name};
              }
              if (metaInput.type == 'list') {
                convertedInputs[metaInput.name] = _.map(inputs[metaInput.id],
                    function(item) {
                      return convertInputs(item, metaInput.metaInputs);
                    });
              } else if (metaInput.type == 'date') {
                var dateMoment = jscalcDateInput.toDate(inputs[metaInput.id],
                    DEFAULTS.dateInputValueType);
                convertedInputs[metaInput.name] = dateMoment ?
                    dateMoment.toDate() : null;
              } else {
                convertedInputs[metaInput.name] = inputs[metaInput.id];
              }
            });
            return convertedInputs;
          };

          var convertUsedInputs = function(usedInputs, metaInputs) {
            var convertedUsedInputs = {};
            _.forEach(metaInputs, function(metaInput) {
              if (!(metaInput.name in usedInputs)) return;
              convertedUsedInputs[metaInput.id] =
                  {used: usedInputs[metaInput.name].used};
              if (metaInput.type == 'list') {
                convertedUsedInputs[metaInput.id].properties =
                    _.mapValues(usedInputs[metaInput.name].properties,
                        function(item) {
                          return {
                            used: item.used,
                            properties: convertUsedInputs(item.properties,
                                metaInput.metaInputs)
                          };
                        });
              }
            });
            return convertedUsedInputs;
          };

          var convertOutputs = function(outputs, metaOutputs) {
            var convertedOutputs = {};
            if (!angular.isObject(outputs)) {
              throw {name: 'JscalcExpectedObjectError'};
            }
            var keys = {};
            _.forEach(metaOutputs, function(metaOutput) {
              if (metaOutput.name in keys) {
                throw {name: 'JscalcNameConflictError',
                    message: metaOutput.name};
              }
              keys[metaOutput.name] = true;
            });
            for (var key in outputs) {
              if (!(key in keys)) {
                throw {name: 'JscalcUnrecognizedOutputError',
                    message: key};
              }
            }
            _.forEach(metaOutputs, function(metaOutput) {
              var output = outputs[metaOutput.name];
              var convertedOutput;
              if (metaOutput.type == 'table') {
                if (output == null || !angular.isDefined(output)) return;
                if (!angular.isArray(output)) {
                  throw {name: 'JscalcExpectedArrayError', message: metaOutput.name};
                }
                if (!output.length) return;
                convertedOutput = _.map(output,
                    function(item) {
                      return convertOutputs(item, metaOutput.metaOutputs);
                    });
              } else if (metaOutput.type == 'value') {
                if (angular.isString(output)) {
                  convertedOutput = {type: 'string', value: output};
                } else if (_.isBoolean(output)) {
                  convertedOutput = {type: 'boolean', value: output};
                } else if (angular.isNumber(output)) {
                  var percentSign = '';
                  if (metaOutput.percent) {
                    output = output / 100;
                    percentSign = '%';
                  }
                  var currencySign = metaOutput.percent ? '' :
                      (metaOutput.currencySign || '');
                  convertedOutput = {type: 'number', value: currencySign +
                    $filter('number')(output, angular.isNumber(metaOutput.decimalPlaces) ? metaOutput.decimalPlaces : undefined) +
                    percentSign};
                } else if (angular.isDate(output)) {
                  convertedOutput = {type: 'date',
                      value: $filter('date')(output, 'mediumDate')};
                } else if (output == null || !angular.isDefined(output)) {
                  return;
                } else {
                  throw {name: 'JscalcValueTypeError', message: metaOutput.name};
                }
              }
              convertedOutputs[metaOutput.id] = convertedOutput;
            });
            return convertedOutputs;
          };

          var refreshWorker = function() {
            if ('isActive' in attr && !$scope.isActive()) {
              workerDirty = true;
              return;
            }
            workerDirty = false;
            if (workerConfig && workerConfig.blobUrl) {
              window.URL.revokeObjectURL(workerConfig.blobUrl)
            };
            var hostUrl = $location.protocol() + '://' + $location.host();
            if ($location.port()) hostUrl += ':' + $location.port();
            var imports = [hostUrl + '/js/worker.js'];
            if ($scope.doc && $scope.doc.libraries) {
              if ($scope.doc.libraries.lodash) imports.push(hostUrl + '/bower_components/lodash/lodash.min.js');
              if ($scope.doc.libraries.moment) imports.push(hostUrl + '/bower_components/moment/min/moment.min.js');
              if ($scope.doc.libraries.mathjs) imports.push(hostUrl + '/bower_components/mathjs/dist/math.min.js');
            }
            var importsStr = 'importScripts(' + _.map(imports, function(importStr) {
              return '"' + importStr + '"';
            }).join(', ') + ');\n';
            var script = 'self.calculate = function(inputs) {' + ($scope.doc.script || DEFAULTS.script) + '};\n\n' + importsStr;
            if (!useEval) {
              workerConfig = {blobUrl: window.URL.createObjectURL(new Blob([script]))};
            } else {
              workerConfig = {script: script};
            }
            if (worker) destroyWorker();
            requestRecalculation();
          };

          $scope.$watch('doc.script', refreshWorker);
          $scope.$watch('doc.libraries', function(newValue, oldValue) {
            // Exclude initialization.
            if (newValue !== oldValue) {
              refreshWorker();
            }
          }, true);
          if ('isActive' in attr) {
            $scope.$watch($scope.isActive, function(newValue) {
              if (newValue && workerDirty) {
                refreshWorker();
              }
            });
          }

          $scope.$watch('doc.metaOutputs', function() {
            requestRecalculation();
          }, true);

          var cancelCalculationTimeout = function() {
            if (calculationTimeoutPromise) {
              $timeout.cancel(calculationTimeoutPromise);
              calculationTimeoutPromise = null;
            }
          };

          var createWorker = function() {
            worker = new Worker(workerConfig.blobUrl || '/js/worker_helper.js');
            if (!workerConfig.blobUrl) {
              worker.postMessage(workerConfig.script);
            }
            worker.onmessage = function(e) {
              $scope.$apply(function() {
                cancelCalculationTimeout();
                $scope.workerBuzy = false;
                if ('outputs' in e.data) {
                  try {
                    $scope.outputs = convertOutputs(e.data.outputs,
                        $scope.doc.metaOutputs);
                    $scope.workerError = null;
                  } catch(err) {
                    if (err.name == 'JscalcExpectedObjectError') {
                      $scope.workerError = {message: 'Outputs and table rows must be objects.'};
                    } else if (err.name == 'JscalcNameConflictError') {
                      $scope.workerError = {message: 'Multiple outputs have name "' + err.message + '".'};
                    } else if (err.name == 'JscalcUnrecognizedOutputError') {
                      $scope.workerError = {message: 'The outputs object or a table row object has unrecognized key "' + err.message + '".'};
                    } else if (err.name == 'JscalcExpectedArrayError') {
                      $scope.workerError = {message: 'Output "' + err.message + '" must be an array, null, or undefined.'};
                    } else if (err.name == 'JscalcValueTypeError') {
                      $scope.workerError = {message: 'Invalid value for "' + err.message + '". Values must be numbers, strings, booleans, nulls, or undefined.'};
                    } else {
                      throw err;
                    }
                    $scope.outputs = null;
                  }
                }
                $scope.usedInputs = convertUsedInputs(e.data.usedInputs,
                    $scope.doc.metaInputs);
              });
            };
            worker.onerror = function(e) {
              $scope.$apply(function() {
                e.preventDefault();
                cancelCalculationTimeout();
                var isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
                var isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
                var errorPrefix = '';
                if (isChrome) errorPrefix = 'Uncaught ';
                if (isFirefox) errorPrefix = 'InternalError: uncaught exception: ';
                var message = e.message;
                if (errorPrefix && message.indexOf(errorPrefix) == 0) {
                  message = message.slice(errorPrefix.length);
                }
                $scope.workerError = {message: message};
                if (e.lineno) {
                  $scope.workerError.lineNumber = e.lineno;
                }
                $scope.outputs = null;
              });
            }
          };

          var destroyWorker = function() {
            worker.terminate();
            worker = null;
            $scope.workerBuzy = false;
            $scope.workerError = null;
            cancelCalculationTimeout();
          };

          var startWorker = function() {
            if (!worker) {
              createWorker();
            }
            if ($scope.workerBuzy) {
              destroyWorker();
              createWorker();
            }
            try {
              var convertedInputs = convertInputs($scope.inputs,
                  $scope.doc.metaInputs);
            } catch(e) {
              if (e.name != 'JscalcNameConflictError') {
                throw e;
              }
              $scope.workerError = {message: 'Multiple inputs have name "' + e.message + '".'};
              return;
            }
            calculationTimeoutPromise = $timeout(function() {
              $scope.workerError = {message: 'Calculation did not finish after 5 seconds. Is there an infinite loop?'};
              $scope.outputs = null;
            }, 5000);
            $scope.workerBuzy = true;
            worker.postMessage({
              inputs: convertedInputs
            });
          };

          var requestRecalculation = function() {
            if (!$scope.doc) return;
            if ($scope.debugMode) return;
            if (!recalculationScheduled) {
              recalculationScheduled = true;
              $timeout(function() {
                recalculationScheduled = false;
                startWorker();
              });
            }
          };

          $scope.$watch(function() {
            try {
              return convertInputs($scope.inputs,
                  $scope.doc.metaInputs);
            } catch (e) {
              if (e.name != 'JscalcNameConflictError') {
                throw e;
              }
              return null;
            }
          }, requestRecalculation, true);

          $scope.toggleDebugMode = function() {
            $scope.debugMode = !$scope.debugMode;
            if (!$scope.debugMode) requestRecalculation();
          };

          $scope.calculate = startWorker;

          $scope.getInputTemplateName = function(metaInput) {
            var getType = function() {
              if (metaInput.type == 'binary') {
                return metaInput.presentationType;
              } else if (metaInput.type == 'choice') {
                return metaInput.presentationType;
              } else {
                return metaInput.type;
              }
            };
            return '/partials/input_' + getType();
          };

          $scope.getOutputTemplateName = function(metaOutput) {
            return '/partials/output_' + metaOutput.type;
          };

          $scope.updateDefaults = function() {
            if (!$scope.doc.defaults) {
              $scope.doc.defaults = {};
            }
            angular.copy($scope.inputs, $scope.doc.defaults);
            $mdToast.show({
              template: '<md-toast>Defaults set to current values.</md-toast>',
              hideDelay: 3000
            });
          };

          $scope.loadDefaults = function() {
            angular.copy($scope.doc.defaults, $scope.inputs);
          };

          $scope.showDefaultsButtons = function() {
            return !angular.equals($scope.doc.defaults || {}, $scope.inputs);
          };

          $scope.addItem = function(items, metaInput) {
            items.push(angular.copy(metaInput.itemPrototype));
          };

          $scope.deleteItem = function(items, index) {
            items.splice(index, 1);
          };

          $scope.getDebuggerText = function() {
            if (navigator.appVersion.indexOf('Trident/') > 0) {
              return ', open Developer Tools, and inside Developer Tools make sure to open the Debugger section (Ctrl + 3)';
            } else {
              return " and open your browser's developer tools";
            }
          }

          $scope.getValueOrDefault = function(value, defaultValue) {
            if (!angular.isDefined(value) || value === null) {
              return defaultValue;
            }
            return value;
          };

          $scope.inputAutohidden = function(metaInput) {
            return metaInput.autohide && !_.property(['usedInputs', metaInput.id, 'used'])($scope);
          };

          $scope.showInput = function(metaInput) {
            return $scope.editMode || !$scope.inputAutohidden(metaInput);
          };

          $scope.outputAutohidden = function(metaOutput) {
            return !_.property(['outputs', metaOutput.id])($scope);
          };

          $scope.showOutput = function(metaOutput) {
            return $scope.editMode || !$scope.outputAutohidden(metaOutput);
          };

          var unregisterOutputsWatch = $scope.$watch('outputs', function(outputs) {
            if (angular.isDefined(outputs)) {
              unregisterOutputsWatch();
              $scope.initialRunCompleted = true;
              $timeout(function() {
                if (!($scope.focusFirstInput && $scope.focusFirstInput())) { return; }
                var inputEls = document.querySelectorAll('#inputs .md-input, #inputs md-select, #inputs md-checkbox, #inputs md-radio-group');
                var firstDisplayed = _.find(inputEls, function(el) {
                  return el.offsetParent !== null;
                });
                if (firstDisplayed) {
                  firstDisplayed.focus();
                }
              });
            }
          });
        }
      };
    }])
  .directive('jscalcListItem', function() {
    return {
      restrict: 'A',
      link: function($scope, element, attrs) {
        $scope.inputAutohidden = function(metaInput) {
          return ($scope.metaInputOuter.autohide && !_.property(['usedInputs', $scope.metaInputOuter.id, 'used'])($scope)) || (metaInput.autohide && !_.property(['usedInputs', $scope.metaInputOuter.id, 'properties', $scope.indexListItem, 'properties', metaInput.id, 'used'])($scope));
        };

        $scope.showInput = function(metaInput) {
          return $scope.editMode || !$scope.inputAutohidden(metaInput);
        };
      }
    }
  })
  .directive('default', function() {
    return {
      restrict: 'A',
      require: 'ngModel',
      scope: {
        defaultValue: '='
      },
      link: function($scope, element, attr, ngModel) {
        function toUser(value) {
          if (!angular.isDefined(value) || value === null) {
            return $scope.defaultValue;
          }
          return value;
        }
        ngModel.$formatters.push(toUser);
      }
    };
  })
  .directive('jscalcNumberToString', function() {
    return {
      restrict: 'A',
      require: 'ngModel',
      link: function($scope, element, attr, ngModel) {
        function toUser(value) {
          return value.toString();
        }
        function fromUser(value) {
          return Number(value);
        }
        ngModel.$formatters.push(toUser);
        ngModel.$parsers.push(fromUser);
      }
    };
  })
  .directive('jscalcDateInput', ['jscalcDateInput', function(jscalcDateInput) {
    return {
      restrict: 'E',
      templateUrl: '/partials/jscalc_date_input',
      scope: {
        value: '=ngModel',
        defaultValueType: '@?'
      },
      compile: function(element, attr) {
        return {
          pre: function($scope, element, attr) {
            $scope.months = [
              {value: 0, label: 'January'},
              {value: 1, label: 'February'},
              {value: 2, label: 'March'},
              {value: 3, label: 'April'},
              {value: 4, label: 'May'},
              {value: 5, label: 'June'},
              {value: 6, label: 'July'},
              {value: 7, label: 'August'},
              {value: 8, label: 'September'},
              {value: 9, label: 'October'},
              {value: 10, label: 'November'},
              {value: 11, label: 'December'}
            ];

            $scope.units = [
              {value: 'days', label: 'Days'},
              {value: 'months', label: 'Months'},
              {value: 'years', label: 'Years'}
            ];

            $scope.getAbsoluteDate = function() {
              return jscalcDateInput.getAbsoluteDate($scope.value && $scope.value.params).toDate();
            };

            $scope.getType = function() {
              return ($scope.value && $scope.value.type) ||
                  $scope.defaultValueType;
            }

            $scope.toggleType = function() {
              var date = jscalcDateInput.toDate($scope.value,
                  $scope.defaultValueType);
              $scope.value.type = {'absolute': 'relative', 'relative': 'absolute'}[$scope.getType()];
              if (date) {
                if ($scope.getType() == 'absolute') {
                  $scope.value.params = {
                    day: date.date(),
                    month: date.month(),
                    year: date.year()
                  };
                } else {
                  $scope.value.params = {
                    delta: date.diff(moment().startOf('day'), 'days'),
                    units: 'days'
                  };
                }
              } else {
                $scope.value.params = {};
              }
            };
          }
        }
      }
    };
  }])
  .directive('jscalcMover', function() {
    return {
      restrict: 'E',
      templateUrl: '/partials/jscalc_mover',
      scope: {
        // A non-empty list of objects.
        items: '=',
        // A string ID of an item from the `items` that will be moved.
        itemId: '=',
        // A function that takes an element of `items` as argument and returns a
        // string label describing the item.
        getLabel: '&',
        // A function that takes an element of `items` as argument and returns a
        // string ID for it.
        getId: '&'
      },
      link: function($scope, element, attr) {
        var updatePositionId = function() {
          var newIndex = _.findIndex($scope.items, function(item) {
            return $scope.getId()(item) == $scope.itemId;
          });
          if (newIndex == 0) {
            $scope.positionId = 'first';
          } else {
            $scope.positionId = 'after_' +
                $scope.getId()($scope.items[newIndex - 1]);
          }
        };

        $scope.$watch('items', function() {
          $scope.positions = [{id: 'first'}];
          $scope.items.forEach(function(item, index) {
            var currentItemId = $scope.getId()(item);
            if (currentItemId != $scope.itemId) {
              $scope.positions.push({
                id: 'after_' + currentItemId,
                item: item
              });
            }
          });
          updatePositionId();
        }, true);

        $scope.$watch('itemId', updatePositionId);

        $scope.handleChange = function() {
          var oldIndex = _.findIndex($scope.items, function(item) {
            return $scope.getId()(item) == $scope.itemId;
          });
          var movedItem = $scope.items[oldIndex];
          $scope.items.splice(oldIndex, 1);
          if ($scope.positionId == 'first') {
            $scope.items.unshift(movedItem);
          } else {
            var position = _.find($scope.positions,
                {id: $scope.positionId});
            var positionItemId = $scope.getId()(position.item);
            var insertionIndex = _.findIndex($scope.items, function(item) {
              return $scope.getId()(item) == positionItemId;
            }) + 1;
            $scope.items.splice(insertionIndex, 0, movedItem);
          }
        };
      }
    };
  });
