'use strict';

/* App Module */

var jscalcApp = angular.module('jscalcApp', [
  'angularytics',
  'http-auth-interceptor',
  'ngRoute',
  'ngMaterial',
  'ui.ace',

  'jscalcControllers',
  'jscalcDirectives',
  'jscalcServices',
  'preloadedData'
])

.constant('DEFAULTS', {
  'tabSize': 2,
  'dateInputValueType': 'relative',
  'script': "'use strict';\n\nreturn {};\n",
  'sliderMin': 0,
  'sliderMax': 100
})

.constant('INPUT_TYPES', [
  {type: 'number', title: 'Number',
      default: null, iconUrl: '/img/icons/number_input_24.svg'},
  {type: 'binary', title: 'Checkbox',
      default: false, iconUrl: '/img/icons/ic_check_box_24px.svg'},
  {type: 'date', title: 'Date',
      default: {"params":{"delta":0,"units":"days"},"type":"relative"},
      iconUrl: '/img/icons/ic_insert_invitation_24px.svg'},
  {type: 'choice', title: 'Radio',
      default: null, iconUrl: '/img/icons/ic_radio_button_on_24px.svg'},
  {type: 'list', title: 'Repeating item',
      default: [], iconUrl: '/img/icons/ic_playlist_add_24px.svg'}
])

.constant('OUTPUT_TYPES', [
  {type: 'value', title: 'Value',
      iconUrl: '/img/icons/number_output_24.svg'},
  {type: 'table', title: 'Table',
      iconUrl: '/img/icons/ic_border_all_24px.svg'}
])

.config(['$routeProvider', '$locationProvider',
  function($routeProvider, $locationProvider) {
    $locationProvider.html5Mode({
      enabled: true,
      requireBase: false
    });

    $routeProvider.
      when('/source/:calcId', {
        templateUrl: '/partials/source',
        controller: 'SourceCtrl'
      }).

      when('/calc/:calcId', {
        templateUrl: '/partials/published',
        controller: 'PublishedCtrl'
      }).

      when('/account', {
        templateUrl: '/partials/account',
        controller: 'AccountCtrl'
      }).

      when('/', {
        templateUrl: '/partials/welcome',
        controller: 'WelcomeCtrl'
      }).

      otherwise({
        redirectTo: '/'
      });
  }])

.config(['AngularyticsProvider',
  function(AngularyticsProvider) {
    AngularyticsProvider.setEventHandlers(['Console', 'GoogleUniversal']);
  }])

.run([
  'Angularytics',
  '$rootScope',
  function(Angularytics, $rootScope) {
    Angularytics.init();
  }])

.run(function($http, $templateCache){
  // Pre-fetch icons sources by URL and cache in the $templateCache...
  // subsequent $http calls will look there first.
  var urls = [
    '/img/icons/ic_add_24px.svg',
    '/img/icons/ic_arrow_forward_24px.svg',
    '/img/icons/ic_border_all_24px.svg',
    '/img/icons/ic_check_box_24px.svg',
    '/img/icons/ic_delete_24px.svg',
    '/img/icons/ic_insert_invitation_24px.svg',
    '/img/icons/ic_menu_24px.svg',
    '/img/icons/ic_more_vert_24px.svg',
    '/img/icons/ic_playlist_add_24px.svg',
    '/img/icons/ic_radio_button_on_24px.svg',
    '/img/icons/ic_save_24px.svg',
    '/img/icons/ic_settings_24px.svg',
    '/img/icons/ic_warning_24px.svg',
    '/img/icons/jscalc_24.svg',
    '/img/icons/jscalc_full_bleed_24.svg',
    '/img/icons/number_input_24.svg',
    '/img/icons/number_output_24.svg',
    '/img/icons/twitter.svg'
  ];
  angular.forEach(urls, function(url) {
    $http.get(url, {cache: $templateCache});
  });
})

.config(function($mdThemingProvider) {
  var lightTextMap = $mdThemingProvider.extendPalette('cyan', {
    'contrastLightColors': '500 600 700 800 900',
    'contrastStrongLightColors': '500 600 700 800'
  });
  $mdThemingProvider.definePalette('lightText', lightTextMap);
  $mdThemingProvider.theme('default')
    .primaryPalette('lightText')
    .accentPalette('yellow');
});
