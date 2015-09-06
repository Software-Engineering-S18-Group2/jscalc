'use strict';

/* Filters */

angular.module('jscalcFilters', []).filter('jscalcLinkify', ['$sce', function($sce) {
  var LINKY_URL_REGEXP =
        /((ftp|https?):\/\/|(www\.)|(mailto:)?[A-Za-z0-9._%+-]+@)\S*[^\s.;,(){}<>"\u201d\u2019]/i,
      MAILTO_REGEXP = /^mailto:/i;

  return function(text) {
    if (!text) return text;
    var match;
    var raw = text;
    var html = [];
    var url;
    var i;

    var escapeHtml = function(text) {
      return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").
          replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    };

    var addText = function(text, maybeShorten) {
      if (!text) {
        return;
      }
      var escaped = escapeHtml(text);
      if (maybeShorten && escaped.length > 30) {
        escaped = escaped.slice(0, 30) + '…';
      }
      html.push(escaped);
    };

    var addLink = function(url, text) {
      html.push('<a target="_blank" rel="nofollow" ');
      html.push('href="',
                url.replace(/"/g, '&quot;'),
                '">');
      addText(text, true);
      html.push('</a>');
    };

    while ((match = raw.match(LINKY_URL_REGEXP))) {
      // We can not end in these as they are sometimes found at the end of the sentence
      url = match[0];
      // if we did not match ftp/http/www/mailto then assume mailto
      if (!match[2] && !match[4]) {
        url = (match[3] ? 'http://' : 'mailto:') + url;
      }
      i = match.index;
      addText(raw.substr(0, i));
      addLink(url, match[0].replace(MAILTO_REGEXP, ''));
      raw = raw.substring(i + match[0].length);
    }
    addText(raw);
    return $sce.trustAsHtml(html.join(''));
  };
}]);
