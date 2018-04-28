'use strict';

/* Controllers */

var jscalcControllers = angular.module('jscalcControllers', []);

jscalcControllers.controller('JscalcCtrl', [
  '$scope',
  '$location',
  '$mdSidenav',
  '$timeout',
  'User',
  '$mdDialog',
  'authService',
  '$mdToast',
  '$http',
  'PRELOADED_DATA',
  '$mdMedia',
  '$document',
  '$templateCache',
  '$q',
  '$window',
  '$mdSelect',
  '$mdMenu',
  function($scope, $location, $mdSidenav, $timeout, User,
      $mdDialog, authService, $mdToast, $http, PRELOADED_DATA, $mdMedia,
      $document, $templateCache, $q, $window, $mdSelect, $mdMenu) {
    $window.addEventListener('blur', function() {
      $mdSelect.hide();
      $mdMenu.hide();
    });
    $scope.user = PRELOADED_DATA.isAuthenticated ? User.get() : null;
    $scope.view = {};
    $scope.calcs = {};

    $scope.setUser = function(user) {
      $scope.user = user;
    };

    $scope.$watch(function() {
      return $mdMedia('min-width: 1400px');
    }, function(wide) {
      $scope.sidenavsLockedOpen = wide && !$location.path().startsWith('/calc/');
    });

    $scope.isCurrentLocation = function(location) {
      return location === $location.path();
    };

    $scope.toggleNav = function() {
      $mdSidenav('left').toggle();
    };

    $scope.closeNav = function() {
      $mdSidenav('left').close();
    }

    $scope.getRandomString = function(length) {
      var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
      var result = '';
      for (var i = length; i > 0; --i) {
        result += chars[Math.round(Math.random() * (chars.length - 1))];
      }
      return result;
    };

    $scope.new = function() {
      $scope.closeNav();
      var id = $scope.getRandomString(16);
      $scope.calcs[id] = {doc: {}, saved: false};
      $location.path('/source/' + id);
    };

    $scope.getCalcNameOrPlaceholder = function(name) {
      return _.trim(name) || 'Untitled calculator';
    };

    $scope.getCalcCaption = function(calc) {
      return (calc.saved ? '' : '[Unsaved] ') +
          $scope.getCalcNameOrPlaceholder(calc.doc ? calc.doc.name : null);
    };

    var getCalcList = function() {
      var calcList = [];
      _.forOwn($scope.calcs, function(calc, calcId) {
        calcList.push({
          caption: $scope.getCalcCaption(calc),
          url: '/source/' + calcId
        });
      });
      if ($scope.user && $scope.user.$resolved) {
        _.forEach($scope.user.calcs, function(calc) {
          if (!(calc._id in $scope.calcs)) {
            calcList.push({
              caption: $scope.getCalcNameOrPlaceholder(calc.doc ? calc.doc.name: null),
              url: '/source/' + calc._id
            });
          }
        });
      }
      return calcList;
    };

    $scope.$watch(getCalcList, function(newValue) {
      $scope.calcList = newValue;
    }, true);

    $scope.login = function($event, signInMode) {
      return $mdDialog.show({
            targetEvent: $event,
            controller: 'AuthDialogCtrl',
            templateUrl: '/partials/auth_dialog',
            onComplete: function(scope, element) {
              element[0].querySelector('#email').focus();
            },
            clickOutsideToClose: true,
            locals: {signInMode: signInMode}
          }).then(function() {
            authService.loginConfirmed();
            if ($scope.user === null) {
              $scope.user = User.get();
            }
          }, function(reason) {
            // 2nd argument is necessary because otherwise requests will not
            // get rejected.
            authService.loginCancelled(null, reason);
            return $q.reject(reason);
          });
    };

    $scope.$on('event:auth-loginRequired', function() {
      $scope.login();
    });

    var areAllChangesSaved = function() {
      return _.every(_.pluck(_.values($scope.calcs), 'saved'));
    };

    $scope.logout = function() {
      if(!areAllChangesSaved()) {
        if(!window.confirm('Discard unsaved changes?')) {
          return;
        }
      }
      $http.get('/api/logout').then(function() {
            $mdToast.show({
              template: '<md-toast>Signed out.</md-toast>',
              hideDelay: 3000
            });
            $scope.user = null;
            $scope.calcs = {};
            $location.path('/');
          });
    };

    window.onbeforeunload = function() {
      if(!areAllChangesSaved()) {
        return 'Unsaved changes will be discarded.'
      }
    };

    $scope.broadcast = function(name) {
      $scope.$broadcast(name);
    };

    $scope.getCanonicalUrl = function() {
      // return 'http://localhost:3000' + $location.path();
      // return 'https://jscalc.io' + $location.path();
      return $location.protocol() + '://' + $location.host() + $location.path();
    };
  }]);

jscalcControllers.controller('SourceCtrl', [
  '$scope',
  '$routeParams',
  '$timeout',
  'Source',
  '$mdToast',
  '$location',
  '$q',
  'DEFAULTS',
  'INPUT_TYPES',
  'TRANSLATIONS',
  '$document',
  function($scope, $routeParams, $timeout, Source, $mdToast, $location, $q,
      DEFAULTS, INPUT_TYPES, TRANSLATIONS, $document) {

    /**
     * UI and calculator resource.
     */

    $scope.DEFAULTS = DEFAULTS;
    $scope.TRANSLATIONS = TRANSLATIONS;
    $scope.view.isEditMode = false;
    $scope.view.isCalcMode = false;
    $scope.view.showCreateCalcButton = false;
    $scope.calcId = $routeParams.calcId;
    $scope.calc = null;
    $scope.inputs = {};

    var calcPromise = $q(function(resolve) {
      if (!($scope.calcId in $scope.calcs)) {
        Source.get({calcId: $scope.calcId}, function(source) {
          if (!($scope.calcId in $scope.calcs)) {
            $scope.calc = {doc: source.doc, saved: true};
            $scope.calcs[$scope.calcId] = $scope.calc;
            resolve();
          } else {
            $scope.calc = $scope.calcs[$scope.calcId];
            resolve();
          }
        });
      } else {
        $scope.calc = $scope.calcs[$scope.calcId];
        resolve();
      }
    });
    calcPromise.then(function() {
      $scope.view.isEditMode = true;
      $scope.view.isCalcMode = true;
      $scope.savedCalcDoc = $scope.calc.saved ?
          angular.copy($scope.calc.doc) : null;
      $scope.$watch(function() {
        if ($scope.savedCalcDoc !== null) {
          if (!angular.equals($scope.savedCalcDoc, $scope.calc.doc)) {
            $scope.calc.saved = false;
            $scope.savedCalcDoc = null;
          }
        }
      });

      var handleKeydown = function(e) {
        if (e.keyCode == 83 && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          $scope.save();
        }
      };
      $document.bind('keydown', handleKeydown);
      $scope.$on('$destroy', function() {
        $document.off('keydown', handleKeydown);
      });
    });
    $scope.saving = false;
    $scope.settingsTemplate = '/partials/settings_blank';
    $scope.selectedTabIndex = 0;
    $scope.$watch(function() {
      if ($scope.calc !== null) {
        return $scope.getCalcCaption($scope.calc);
      }
      return '';
    }, function(newCaption) {
      $scope.title = newCaption;
      $scope.view.title = newCaption;
    });
    $scope.$watch(function() {
      return !$scope.user || !$scope.user.$resolved ||
          !_.find($scope.user.calcs, {_id: $scope.calcId});
    }, function(newValue) {
      $scope.newAndNotSaved = newValue;
    });
    $scope.view.description = '';

    var editorPromise = $q(function(resolve) {
      $scope.onAceLoad = function(editor) {
        $scope.editor = editor;
        resolve();
      };
    });
    editorPromise.then(function() {
      var updateJshintOptions = function() {
        if ($scope.editor.getSession().$worker) {
          var predefs = ["inputs"];
          if ($scope.calc && $scope.calc.doc && $scope.calc.doc.libraries) {
            if ($scope.calc.doc.libraries.lodash) predefs.push('_');
            if ($scope.calc.doc.libraries.moment) predefs.push('moment');
            if ($scope.calc.doc.libraries.mathjs) predefs.push('math');
          }
          $scope.editor.getSession().$worker.send("setOptions", [{
            undef: true,
            predef: predefs,
            unused: true,
            globalstrict: true,
            debug: true,
            devel: true,
            worker: true
          }]);
        }
      };
      $scope.editor.getSession().on("changeMode", updateJshintOptions);
      $scope.editor.getSession().setMode("ace/mode/javascript");
      $scope.$watch('calc.doc.libraries', updateJshintOptions, true);
    });
    $q.all([calcPromise, editorPromise]).then(function() {
      $scope.editor.getSession().setValue($scope.calc.doc.script ||
          DEFAULTS.script);

      $scope.editor.getSession().on("change", function(e) {
        $scope.$apply(function() {
          $scope.calc.doc.script = $scope.editor.getSession().getValue();
        });
      });

      $scope.$watch('calc.doc.tabSize', function(newValue) {
        $scope.editor.getSession().setTabSize(newValue || DEFAULTS.tabSize);
      });

      $scope.gotoLine = function(lineNumber) {
        $scope.selectedTabIndex = 1;
        $timeout(function() {
          $scope.editor.resize(true);
          $scope.editor.scrollToLine(lineNumber, true, true, function () {});
          $scope.editor.gotoLine(lineNumber);
        });
      };
    });
    $scope.$watch('selectedTabIndex', function(value) {
      if (value == 1) {
        $timeout(function() {
          if ($scope.editor !== null) {
            $scope.editor.resize(true);
            var iOS = /iPad|iPhone|iPod/.test(navigator.platform);
            // The editor should initially not be focused on iOS, because when
            // the user tabs a focused editor, the keyboard is not brought up.
            if (!iOS) {
              $scope.editor.focus();
            }
            $timeout(function() {
              $scope.editor.resize(true);
            }, 100)
          }
        });
      }
    });

    $scope.ioVisible = function() {
      return $scope.selectedTabIndex == 0;
    };

    $scope.save = function($event) {
      $scope.saving = true;
      var post = function() {
        return Source.post({calcId: $scope.calcId}, {doc: $scope.calc.doc}).
            $promise.then(function() {
              $scope.calc.saved = true;
              $scope.savedCalcDoc = angular.copy($scope.calc.doc);
              if ($scope.user !== null) {
                var maybeAddCalc = function() {
                  if (!_.find($scope.user.calcs, {_id: $scope.calcId})) {
                    $scope.user.calcs.push({_id: $scope.calcId, doc: $scope.calc.doc});
                  }
                };
                if ($scope.user.$resolved) {
                  maybeAddCalc();
                } else {
                  $scope.user.$promise.then(maybeAddCalc);
                }
              }
              $mdToast.show({
                template: '<md-toast>Calculator has been saved!</md-toast>',
                hideDelay: 3000
              });
            });
      };
      if ($scope.user === null) {
        // For better dialog animation we pass the $event.
        $scope.login($event).then(post).finally(function() {
          $scope.saving = false;
        });
      } else {
        post().finally(function() {
          $scope.saving = false;
        });
      }
    };

    $scope.$on('jscalc-delete', function() {
      if (!window.confirm('Are you sure you want to delete this calculator?')) return;
      var finish = function() {
        $mdToast.show({
          template: '<md-toast>Calculator has been deleted!</md-toast>',
          hideDelay: 3000
        });
        $location.path('/');
      };
      if (!_.find($scope.user.calcs, {_id: $scope.calcId})) {
        delete $scope.calcs[$scope.calcId];
        finish();
      } else {
        Source.delete({calcId: $scope.calcId}).
            $promise.then(function() {
              _.remove($scope.user.calcs, {_id: $scope.calcId});
              delete $scope.calcs[$scope.calcId];
              finish();
            });
      }
    });

    $scope.$on('jscalc-copy', function() {
      var id = $scope.getRandomString(16);
      $scope.calcs[id] = {doc: angular.copy($scope.calc.doc), saved: false};
      $location.path('/source/' + id);
    });

    /**
     * Calculator configuration.
     */

    $scope.openSettings = function(settingsTemplate, settingsModel) {
      $scope.settingsTemplate = settingsTemplate;
      $scope.settingsModel = settingsModel;
      if (!$scope.sidenavsLockedOpen) {
        $timeout(function() {
          $scope.settingsOpen = true;
        });
      }
    };

    /**
     * From the supplied inputs object, removes those inputs that no longer have
     * corresponding metainputs, and fills in missing inputs with default
     * values. Called on calculator inputs and on default inputs whenever
     * metainputs are added/removed.
     */
    var fixInputs = function(inputs, metaInputs) {
      var idsHash = {};
      _.forEach(metaInputs, function(metaInput) {
        idsHash[metaInput.id] = true;
        if (!(metaInput.id in inputs)) {
          inputs[metaInput.id] = angular.copy(
              _.find(INPUT_TYPES, {type: metaInput.type}).default);
        }
        if (metaInput.type == 'list') {
          _.forEach(inputs[metaInput.id], function(inputs) {
            fixInputs(inputs, metaInput.metaInputs);
          });
          fixInputs(metaInput.itemPrototype, metaInput.metaInputs);
        }
      });
      for (var id in inputs) {
        if (!(id in idsHash)) {
          delete inputs[id];
        }
      }
    };

    /**
     * Returns a new unused numeric id, takes as argument an array of objects
     * each with property 'id'.
     */
    var getNewId = function(items) {
      var id = 0;
      _.forEach(items, function(item) {
        if (item.id > id) {
          id = item.id;
        }
      });
      return id + 1;
    };

    /**
     * Returns a new unused name. Takes as an argument a function that
     * iteratively calls its callback for each existing name, with that name
     * as argument.
     */
    var getNewName = function(f) {
      var namesHash = {};
      var addName = function(name) {
        namesHash[name] = true;
      };
      f(addName);
      var letters = 'abcdefghijklmnopqrstuvwxyz';
      var getNameOfLength = function(prefix, length) {
        if (!length) {
          return (prefix in namesHash) ? undefined : prefix;
        }
        for (var i = 0; i < letters.length; i++) {
          var letter = letters[i];
          var name = getNameOfLength(prefix + letter, length - 1);
          if (name) return name;
        }
      };
      var length = 1;
      var name;
      while(true) {
        name = getNameOfLength('', length);
        if (name) return name;
        length += 1;
      }
    };

    $scope.addInput = function($event, metaInputs, nested, inputType) {
      var metaInput = {
        id: getNewId(metaInputs),
        name: getNewName(function(f) {
          _.forEach(metaInputs, function(metaInput) {
            f(metaInput.name);
          });
        }),
        type: inputType
      };
      if (inputType == 'binary') {
        metaInput.presentationType = 'checkbox';
      }
      if (inputType == 'choice') {
        metaInput.presentationType = 'radio';
      }
      if (inputType == 'list') {
        metaInput.metaInputs = [];
        metaInput.itemPrototype = {};
      }
      metaInputs.push(metaInput);
      if (!$scope.calc.doc.defaults) {
        $scope.calc.doc.defaults = {};
      }
      fixInputs($scope.calc.doc.defaults, $scope.calc.doc.metaInputs);
      fixInputs($scope.inputs, $scope.calc.doc.metaInputs);
    };

    $scope.addOutput = function($event, outputType) {
      if (!('metaOutputs' in $scope.calc.doc)) {
        $scope.calc.doc.metaOutputs = [];
      }
      $scope.calc.doc.metaOutputs.push({
        id: getNewId($scope.calc.doc.metaOutputs),
        name: getNewName(function(f) {
          _.forEach($scope.calc.doc.metaOutputs, function(metaOutput) {
            f(metaOutput.name);
          });
        }),
        type: outputType
      });
    };

    $scope.configureInput = function(metaInputs, metaInput) {
      $scope.openSettings('/partials/settings_' + metaInput.type, {
        metaInputs: metaInputs,
        metaInput: metaInput
      });
    };

    $scope.configureOutput = function(metaOutputs, metaOutput) {
      $scope.openSettings('/partials/settings_' + metaOutput.type, {
        metaOutputs: metaOutputs,
        metaOutput: metaOutput
      });
    };

    $scope.addChoice = function(metaInput) {
      if (!('choices' in metaInput)) {
        metaInput.choices = [];
      };
      metaInput.choices.push({
        id: getNewId(metaInput.choices),
        label: '',
        value: getNewName(function(f) {
          _.forEach(metaInput.choices, function(choice) {
            f(choice.value);
          });
        })
      });
    };

    $scope.deleteChoice = function(choices, id) {
      _.remove(choices, {id: id});
    };

    $scope.deleteInput = function(metaInputs, id) {
      _.remove(metaInputs, {id: id});
      fixInputs($scope.calc.doc.defaults, $scope.calc.doc.metaInputs);
      fixInputs($scope.inputs, $scope.calc.doc.metaInputs);
    };

    $scope.deleteOutput = function(id) {
      _.remove($scope.calc.doc.metaOutputs, {id: id});
    };

    $scope.isNameConflict = function(metaInputs, metaInput) {
      var otherMetaInputs = _.reject(metaInputs, {'id': metaInput.id});
      return _.some(otherMetaInputs, {'name': metaInput.name});
    };

    $scope.getLabel = function(obj) {
      return obj.label || '[Label]';
    };

    $scope.getId = function(obj) {
      return obj.id;
    };

    $scope.addColumn = function(metaOutput) {
      if (!('metaOutputs' in metaOutput)) {
        metaOutput.metaOutputs = [];
      };
      metaOutput.metaOutputs.push({
        id: getNewId(metaOutput.metaOutputs),
        name: getNewName(function(f) {
          _.forEach(metaOutput.metaOutputs, function(metaOutput) {
            f(metaOutput.name);
          });
        }),
        type: 'value'
      });
    };

    $scope.deleteColumn = function(metaInputs, id) {
      _.remove(metaInputs, {id: id});
    };

    var quote = function(s) {
      // Modified version of polyfill on https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/quote

      // prepare fallback
      // ----------------
      // backslash escape single quotes and backslashes
      var escp_regex = /[\\']/g,
        escp_callback = '\\$&',
        // escape control characters
        ctrl_map = {
          '\b': '\\b', // backspace
          '\t': '\\t', // tab
          '\n': '\\n', // new line
          '\f': '\\f', // form feed
          '\r': '\\r'  // carriage return
        },
        // don't rely on `Object.keys(ctrl_map).join('')`
        ctrl_regex = new RegExp('[\b\t\n\f\r]', 'g'),
        ctrl_callback = function(match){
          return ctrl_map[match];
        },
        // hex-escape, spare out control characters and ASCII printables
        // [0-7,11,14-31,127-255]
        xhex_regex = /[\x00-\x07\x0B\x0E-\x1F\x7F-\xFF]/g,
        xhex_callback = function(match, char_code){
          char_code = match.charCodeAt(0);
          return '\\x' + (char_code < 16 ? '0' : '') + char_code;
        },
        // hex-escape all others
        uhex_regex = /[\u0100-\uFFFF]/g,
        uhex_callback = function(match, char_code){
          char_code = match.charCodeAt(0);
          return '\\u' + (char_code < 4096 ? '0' : '') + char_code;
        };

      return "'" + s
        .replace(escp_regex, escp_callback)
        .replace(ctrl_regex, ctrl_callback)
        .replace(xhex_regex, xhex_callback)
        .replace(uhex_regex, uhex_callback) + "'";
    };

    var looksValidJsName = function(s) {
      // See http://stackoverflow.com/a/2008444/2852295
      return /^[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*$/.test(s);
    };

    $scope.getInputsSchema = function() {
      var f = function(prefix, metaInputs) {
        var s = '{\n';
        s += _.map(metaInputs, function(metaInput) {
          var name = metaInput.name;
          if (!looksValidJsName(name)) {
            name = quote(name);
          }
          var s = '';
          if (metaInput.type == 'list') {
            s += prefix + '  // Careful: in UI items are numbered starting\n'
            s += prefix + '  // from 1, but array indexes start from 0.\n'
          }
          s += prefix + '  ' + name + ':';
          if (metaInput.type == 'number') {
            s += ' <number or null>';
          } else if (metaInput.type == 'string') {
            s += ' <string>';
          } else if (metaInput.type == 'binary') {
            s += ' <boolean or null>';
          } else if (metaInput.type == 'date') {
            s += ' <instance of Date or null>';
          } else if (metaInput.type == 'choice') {
            var choices = _.map(metaInput.choices, function(choice) {
              return quote(choice.value);
            });
            choices.push(choices.length ? 'null' : 'null (no choices have been added yet)');
            var joined;
            if (choices.length == 1) {
              joined = choices[0];
            } else if (choices.length == 2) {
              joined = choices.join(' or ');
            } else {
              var joinedWithComma = choices.slice(0, choices.length - 1).join(', ');
              joined = [joinedWithComma, choices[choices.length - 1]].join(', or ');
            }
            s += ' <' + joined + '>';
          } else if (metaInput.type == 'list') {
            s += ' [';
            s += f(prefix + '  ', metaInput.metaInputs) + ', ...]';
          }
          return s;
        }).join(',\n');
        return s + '\n' + prefix + '}';
      };
      return f('', $scope.calc.doc.metaInputs);
    };


    $scope.getOutputsSchema = function() {
      var f = function(prefix, metaOutputs) {
        var s = '{\n';
        s += _.map(metaOutputs, function(metaOutput) {
          var name = metaOutput.name;
          if (!looksValidJsName(name)) {
            name = quote(name);
          }
          var s = prefix + '  ' + name + ':';
          if (metaOutput.type == 'value') {
            s += ' <number, boolean, Date, string, or null>';
          } else if (metaOutput.type == 'table') {
            if (!metaOutput.metaOutputs ||!metaOutput.metaOutputs.length) {
              s += ' <no columns have been added yet>';
            } else {
              s += ' [';
              s += f(prefix + '  ', metaOutput.metaOutputs) + ', ...]';
            }
          }
          return s;
        }).join(',\n');
        return s + '\n' + prefix + '}';
      };
      return f('', $scope.calc.doc.metaOutputs);
    };
  }]);


jscalcControllers.controller('PublishedCtrl', [
  '$scope',
  '$routeParams',
  'Calc',
  '$location',
  '$mdDialog',
  '$log',
  function ($scope, $routeParams, Calc, $location, $mdDialog, $log) {
    $scope.calcId = $routeParams.calcId;
    $scope.calc = null;
    $scope.inputs = {};
    if ($location.hash()) {
      try {
        $scope.defaults = angular.fromJson($location.hash());
      } catch (e) {
        $log.warn('Hash fragment could not be JSON-parsed.', e);
      }
    }
    $scope.view.isEditMode = false;
    $scope.view.isCalcMode = false;
    $scope.view.showCreateCalcButton = false;
    $scope.title = '';
    $scope.view.title = '';
    Calc.get({calcId: $scope.calcId}, function(calc) {
      $scope.calc = {doc: calc.doc};
      var caption = $scope.getCalcNameOrPlaceholder(calc.doc ? calc.doc.name: null);
      $scope.title = caption;
      $scope.view.title = caption;
      $scope.view.description = (calc.doc && calc.doc.description) || 'An online calculator';
      $scope.view.isCalcMode = true;
    });

    // TODO: this duplicates the handler in SourceCtrl.
    $scope.$on('jscalc-copy', function() {
      var id = $scope.getRandomString(16);
      $scope.calcs[id] = {doc: angular.copy($scope.calc.doc), saved: false};
      $location.path('/source/' + id);
    });

    var getValuesUrl = function(facebookFix) {
      var url = $scope.getCanonicalUrl();
      if (facebookFix) {
        // Prevent Facebook from serving cached data. The proper way to do this
        // would have been to invalidate cache when calculator is saved, but a
        // post to graph.facebook.com with "scrape=true" results in error saying
        // that URL could not be parsed.
        url += '?rnd=' + $scope.getRandomString(5);
      }
      url += '#' +
          encodeURI(angular.toJson($scope.inputs));
      return url;
    };

    var displayPopup = function(url) {
      var windowOptions = 'scrollbars=yes,resizable=yes,toolbar=no,location=yes',
      width = 550,
      height = 420,
      winHeight = screen.height,
      winWidth = screen.width,
      left = Math.round((winWidth / 2) - (width / 2)),
      top = 0;

      if (winHeight > height) {
        top = Math.round((winHeight / 2) - (height / 2));
      }

      window.open(url, 'intent',
          windowOptions + ',width=' + width +
          ',height=' + height + ',left=' + left + ',top=' + top);

    };

    $scope.shareTwitter = function() {
      displayPopup('https://twitter.com/intent/tweet?text=' +
          encodeURIComponent($scope.title + ' ' + getValuesUrl()));
    };

    $scope.shareFacebook = function() {
      displayPopup('http://www.facebook.com/sharer/sharer.php?u=' +
          encodeURIComponent(getValuesUrl(true)));
    };

    $scope.shareEmail = function() {
      window.open('mailto:?subject=' + encodeURIComponent($scope.title) +
          '&body=' + encodeURIComponent(getValuesUrl()), '_blank')
    };

    $scope.shareLink = function($event) {
      $mdDialog.show({
        targetEvent: $event,
        controller: 'ShareLinkDialogCtrl',
        templateUrl: '/partials/share_link_dialog',
        onComplete: function(scope, element) {
          element[0].querySelector('#link').select();
        },
        clickOutsideToClose: true,
        locals: {url: getValuesUrl()}
      });
    };
  }]);

jscalcControllers.controller('EmbedCtrl', [
  '$scope',
  '$routeParams',
  'Calc',
  '$location',
  '$log',
  function($scope, $routeParams, Calc, $location, $log) {
    $scope.calcId = $routeParams.calcId;
    $scope.calc = null;
    $scope.inputs = {};
    if ($location.hash()) {
      try {
        $scope.defaults = angular.fromJson($location.hash());
      } catch (e) {
        $log.warn('Hash fragment could not be JSON-parsed.', e);
      }
    }
    $scope.view.isEditMode = false;
    $scope.view.isCalcMode = false;
    $scope.view.showCreateCalcButton = false;
    $scope.title = '';
    $scope.view.title = '';
    $scope.focusFirstInput = ($location.search().autofocus === '1');
    console.log($location.search().autofocus, $scope.focusFirstInput)
    Calc.get({calcId: $scope.calcId}, function(calc) {
      $scope.calc = {doc: calc.doc};
      var caption = $scope.getCalcNameOrPlaceholder(calc.doc ? calc.doc.name: null);
      $scope.title = caption;
      $scope.view.title = caption;
      $scope.view.description = (calc.doc && calc.doc.description) || 'An online calculator';
      $scope.view.isCalcMode = true;
    });
  }]);

jscalcControllers.controller('ToolbarToolsCtrl', ['$scope',
  function($scope) {
  }]);

jscalcControllers.controller('AuthDialogCtrl', [
  '$scope',
  '$mdDialog',
  '$mdToast',
  '$http',
  '$q',
  'Angularytics',
  'signInMode',
  function($scope, $mdDialog, $mdToast, $http, $q, Angularytics, signInMode) {
    $scope.signInMode = signInMode;
    $scope.canceler = null;
    $scope.params = {};

    $scope.toggleMode = function() {
      $scope.signInMode = !$scope.signInMode;
      $scope.errorMessage = '';
    };


    $scope.submit = function() {
      if ($scope.signInMode) {
        $scope.signIn();
      } else {
        $scope.signUp();
      }
    };

    $scope.handleKeydown = function($event) {
      if ($event.keyCode == 13) {
        $event.preventDefault();
        $scope.submit();
      }
    };

    $scope.cancel = function() {
      if ($scope.canceler !== null) {
        $scope.canceler.resolve();
      }
      $mdDialog.cancel();
    };

    $scope.signUp = function() {
      $scope.canceler = $q.defer();
      $http.post('/api/signup', $scope.params,
          {timeout: $scope.canceler.promise}).then(function() {
          $mdToast.show({
              template: '<md-toast>Hi! Welcome to JSCalc.io. TO know how to use, please click  <a href="https://www.youtube.com/watch?v=bLIiqTTu8eo" target="_blank"> here </md-toast>',
              hideDelay: 3000
          });
          $mdDialog.hide();
            Angularytics.trackEvent("Account", "Sign up");
          }, function(reason) {
            $scope.canceler = null;
            $scope.errorMessage = reason.data || 'Oops, an error.';
          });
    };

    $scope.signIn = function() {
      $scope.canceler = $q.defer();
      $http.post('/api/login', $scope.params,
          {timeout: $scope.canceler.promise}).then(function() {
          $mdToast.show({
              template: '<md-toast>Welcome to JSCalc.io, You have successfully logged in.</md-toast>',
              hideDelay: 3000
          });
            $mdDialog.hide();
          }, function(reason) {
            $scope.canceler = null;
            $scope.errorMessage = reason.data || 'Oops, an error.';
          });
    };

    $scope.forgot = function() {
      window.open('/forgot', '_blank');
    }
  }]);

jscalcControllers.controller('ShareLinkDialogCtrl', [
  '$scope',
  '$mdDialog',
  'url',
  function($scope, $mdDialog, url) {
    $scope.url = url;

    $scope.openLink = function() {
      window.open($scope.url, '_blank');
      $mdDialog.hide();
    };
    $scope.close = function() {
      $mdDialog.cancel();
    };
  }]);

jscalcControllers.controller('AccountCtrl', [
  '$scope',
  'User',
  '$mdToast',
  '$location',
  function($scope, User, $mdToast, $location) {
    $scope.processingEmail = false;
    $scope.processingPassword = false;
    $scope.processingDeleteAccount = false;
    $scope.emailParams = {};
    $scope.passwordParams = {};
    $scope.title = 'Account Settings';
    $scope.view.isEditMode = false;
    $scope.view.isCalcMode = false;
    $scope.view.showCreateCalcButton = false;
    $scope.view.title = 'Account Settings';
    $scope.view.description = '';

    $scope.changeEmail = function() {
      $scope.processingEmail = true;
      User.saveEmail($scope.emailParams).$promise.then(function() {
        $mdToast.show({
          template: '<md-toast>Email has been changed.</md-toast>',
          hideDelay: 3000
        });
        if ($scope.user.email) {
          $scope.user.email = $scope.emailParams.email;
        }
        $scope.emailParams.email = '';
      }).finally(function() {
        $scope.processingEmail = false;
      });
    };

    $scope.changePassword = function() {
      $scope.processingPassword = true;
      User.savePassword($scope.passwordParams).$promise.then(function() {
        $mdToast.show({
          template: '<md-toast>Password has been changed.</md-toast>',
          hideDelay: 3000
        });
        $scope.passwordParams.oldPassword = '';
        $scope.passwordParams.newPassword = '';
        $scope.passwordParams.confirmPassword = '';
      }).finally(function() {
        $scope.processingPassword = false;
      });
    };


    $scope.deleteAccount = function() {
      if (window.confirm("Careful: are you sure you want to permanently delete your account?")) {
        $scope.processingDeleteAccount = true;
        User.delete().$promise.then(function() {
          $mdToast.show({
            template: '<md-toast>Your account has been deleted.</md-toast>',
            hideDelay: 3000
          });
          $scope.setUser(null);
          $location.path('/');
        }).finally(function() {
          $scope.processingDeleteAccount = false;
        });
      }
    };
  }]);


jscalcControllers.controller('WelcomeCtrl', [
  '$scope',
  function($scope) {
    $scope.view.isEditMode = false;
    $scope.view.isCalcMode = false;
    $scope.view.showCreateCalcButton = true;
    $scope.title = 'Welcome to JSCalc.io!';
    $scope.view.title = 'Build a Custom Online Calculator';
    $scope.view.description = 'A free and open-source web service that lets you quickly create a custom embeddable calculator.';
  }]);


jscalcControllers.controller('TermsCtrl', [
  '$scope',
  function($scope) {
    $scope.view.isEditMode = false;
    $scope.view.isCalcMode = false;
    $scope.view.showCreateCalcButton = false;
    $scope.title = $scope.view.title = 'Terms of Service';
    $scope.view.description = '';
  }]);


jscalcControllers.controller('PrivacyCtrl', [
  '$scope',
  function($scope) {
    $scope.view.isEditMode = false;
    $scope.view.isCalcMode = false;
    $scope.view.showCreateCalcButton = false;
    $scope.title = $scope.view.title = 'Privacy Policy';
    $scope.view.description = '';
  }]);
