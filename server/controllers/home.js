var _ = require('lodash');
var async = require('async');
var fs = require('fs');
var jade = require('jade');
var path = require('path');
var Calc = require('../models/Calc');


var rootDir = path.join(__dirname, '../..');
var clientDir = path.join(rootDir, 'client');

/**
 * GET /
 * Home page.
 */

exports.index = function(req, res, next) {
  var partialsDir = path.join(clientDir, 'views', 'partials_angular');
  fs.readdir(partialsDir,
      function(err, files) {
        if (err) return next(err);
        files = _.reject(files, function(file) {
          return file.indexOf('.') == 0;
        });
        async.parallel(_.map(files, function(file) {
          return function(done) {
            fs.readFile(path.join(partialsDir, file), function(err, data) {
              if (err) return done(err);
              var html = jade.compile(data)();
              done(null, '<script type="text/ng-template" id="/partials/' + path.basename(file, '.jade') + '">' +
                  html +
                  '</script>');
            });
          };
        }), function(err, results) {
          if (err) return next(err);
          res.render('index', {
            preloaded: {isAuthenticated: req.isAuthenticated()},
            partials: results.join('')
          });
        });
      });
};


/**
 * GET '/calc/:calcId' for social network bots.
 * Calculator OG meta tags.
 */

exports.getCalcMetaTags = function(req, res, next) {
  Calc.findById(req.params.calcId, function(err, calc) {
    if (err) return next(err);
    if (calc) {
      if (calc.published) {
        res.render('calc_metatags', {
          title: ((calc.doc && calc.doc.name) || 'Untitled calculator').trim(),
          description: (calc.doc && calc.doc.description) || 'An online calculator'
        })
      } else {
        res.sendStatus(403);
      }
    } else {
      res.sendStatus(404);
    }
  });
};
