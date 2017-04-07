  'use strict';

/* App Module */

var jscalcApp = angular.module('jscalcApp', [
  'angularytics',
  'http-auth-interceptor',
  'ngRoute',
  'ngAnimate',
  'ngMaterial',
  'ui.ace',
  'ngMessages',

  'jscalcControllers',
  'jscalcDirectives',
  'jscalcServices',
  'jscalcFilters',
  'preloadedData'
])

.constant('DEFAULTS', {
  'tabSize': 2,
  'dateInputValueType': 'relative',
  'script': "'use strict';\n\nreturn {};\n",
  'sliderMin': 0,
  'sliderMax': 100,
  'locale': 'en'
})

.constant('INPUT_TYPES', [
  {type: 'number', title: 'Number',
      default: null},
  {type: 'string', title: 'Text',
      default: null},
  {type: 'binary', title: 'Checkbox',
      default: false},
  {type: 'date', title: 'Date',
      default: {"params":{"delta":0,"units":"days"},"type":"relative"}},
  {type: 'choice', title: 'Radio/Dropdown',
      default: null},
  {type: 'list', title: 'Repeating item',
      default: []}
])

.constant('OUTPUT_TYPES', [
  {type: 'value', title: 'Value'},
  {type: 'table', title: 'Table'}
])

.constant('TRANSLATIONS', {
  'en': {
    language: 'English',
    inputs: 'Inputs',
    outputs: 'Outputs'
  },
  'ru': {
    language: 'Russian',
    inputs: 'Входные данные',
    outputs: 'Результаты'
  }
})

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

      when('/embed/:calcId', {
        templateUrl: '/partials/embed',
        controller: 'EmbedCtrl'
      }).

      when('/account', {
        templateUrl: '/partials/account',
        controller: 'AccountCtrl'
      }).

      when('/terms', {
        templateUrl: '/partials/terms',
        controller: 'TermsCtrl'
      }).

      when('/privacy', {
        templateUrl: '/partials/privacy',
        controller: 'PrivacyCtrl'
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
    '/img/icons/ic_delete_24px.svg',
    '/img/icons/ic_menu_24px.svg',
    '/img/icons/ic_more_vert_24px.svg',
    '/img/icons/ic_save_24px.svg',
    '/img/icons/ic_settings_24px.svg',
    '/img/icons/ic_warning_24px.svg',
    '/img/icons/twitter.svg',
    '/img/icons/twitter-box.svg',
    '/img/icons/facebook-box.svg',
    '/img/icons/email.svg',
    '/img/icons/link-variant.svg'
  ];
  angular.forEach(urls, function(url) {
    $http.get(url, {cache: $templateCache});
  });
})

.config(function($mdThemingProvider) {
  var lightTextMap = $mdThemingProvider.extendPalette('blue', {
  });
  $mdThemingProvider.definePalette('lightText', lightTextMap);
  $mdThemingProvider.theme('default')
    .primaryPalette('lightText')
    .accentPalette('yellow');
  $mdThemingProvider.theme('alternative')
    .primaryPalette('blue')
    .accentPalette('yellow')
    .dark();
});
