'use strict';

/* Services */

var jscalcServices = angular.module('jscalcServices', ['ngResource']);

jscalcServices.factory('User', ['$resource', 'toastInterceptor',
  function($resource, toastInterceptor){
    return $resource('/api/account', {}, {
      get: {method:'PUT', interceptor: toastInterceptor},
      saveEmail: {method:'POST', url: '/api/account/email',
          interceptor: toastInterceptor},
      savePassword: {method:'POST', url: '/api/account/password',
          interceptor: toastInterceptor},
      delete: {method:'DELETE', interceptor: toastInterceptor}
    });
  }]).
  factory('Source', ['$resource', 'toastInterceptor',
    function($resource, toastInterceptor){
      return $resource('/api/source/:calcId', {calcId:'@id'}, {
        get: {method:'GET', interceptor: toastInterceptor},
        post: {method:'POST', interceptor: toastInterceptor},
        delete: {method:'DELETE', interceptor: toastInterceptor}
      });
    }]).
  factory('Calc', ['$resource', 'toastInterceptor',
    function($resource, toastInterceptor){
      return $resource('/api/calc/:calcId', {calcId:'@id'}, {
        get: {method:'GET', interceptor: toastInterceptor}
      });
    }]).
  factory('toastInterceptor', ['$mdToast', '$q', function($mdToast, $q) {
    return {
      responseError: function(rejection) {
        if (rejection.status == 400) {
          $mdToast.show({
            template: '<md-toast>' + rejection.data + '</md-toast>',
            hideDelay: 3000
          });
        } else {
          $mdToast.show({
            template: '<md-toast>Oops, an error.</md-toast>',
            hideDelay: 3000
          });
        }
        return $q.reject(rejection);
      }
    };
  }]).
  factory('jscalcDateInput', [function() {
    var getAbsoluteDate = function(relativeParams) {
      if (!relativeParams) {
        return moment().startOf('day');
      }
      return moment()
          .startOf('day')
          .add(relativeParams.delta || 0, relativeParams.units || 'days');
    };

    return {
      getAbsoluteDate: getAbsoluteDate,
      toDate: function(value, defaultValueType) {
        if (((value && value.type) || defaultValueType) == 'absolute') {
          if (!value) return null;
          if (!value.params) return null;
          if (!value.params.day) return null;
          if (!value.params.month && value.params.month !== 0) return null;
          if (!value.params.year && value.params.year !== 0) return null;
          return moment({
            day: value.params.day,
            month: value.params.month,
            year: value.params.year
          });
        } else {
          return getAbsoluteDate(value && value.params);
        }
      }
    };
  }]);
