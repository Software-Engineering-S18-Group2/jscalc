var _ = require('lodash');
var async = require('async');
var User = require('../models/User');
var Calc = require('../models/Calc');

/**
 * GET '/api/source/:calcId'
 * Calculator source.
 */

exports.getSource = function(req, res, next) {
  Calc.findById(req.params.calcId, function(err, calc) {
    if (err) return next(err);
    if (calc) {
      if (_.find(calc.permissions, function(permission) {
        return permission.user == req.user.id && permission.level == 'owner';
      })) {
        res.send(_.pick(calc, ['doc', 'published']));
      } else {
        res.sendStatus(403);
      }
    } else {
      res.sendStatus(404);
    }
  });
};

/**
 * POST '/api/source/:calcId'
 * Update calculator source. If does not exist, saves for the first time and
 * adds to the user's list of calculators.
 * @param doc
 */

exports.postSource = function(req, res, next) {
  Calc.findById(req.params.calcId, function(err, calc) {
    if (err) return next(err);
    var isNew = false;
    if (!calc) {
      isNew = true;
      calc = new Calc({
        _id: req.params.calcId,
        permissions: [{user: req.user.id, level: 'owner'}],
        published: true
      });
    }
    _.assign(calc, _.pick(req.body, ['doc']));
    async.parallel([
      function(done) {
        calc.save(function(err) {
          done(err);
        });
      },
      function(done) {
        if (!isNew) {
          return done();
        }
        User.findById(req.user.id, function(err, user) {
          if (err) return done(err);

          // calcId may be already present if a calculator with this ID was
          // previously deleted but removal from user.calcs failed.
          if (user.calcs.indexOf(req.params.calcId) != -1) {
            return done();
          }

          user.calcs.push(req.params.calcId);

          user.save(function(err) {
            done(err);
          });
        });
      }
    ], function(err) {
      if (err) return next(err);
      res.end();
    });
  });
};

/**
 * DELETE '/api/source/:calcId'
 * Delete calculator.
 */

exports.deleteSource = function(req, res, next) {
  async.parallel([
    function(done) {
      Calc.remove({_id: req.params.calcId}, function(err) {
        done(err);
      });
    },
    function(done) {
      User.findById(req.user.id, function(err, user) {
        if (err) return done(err);

        user.calcs = _.without(user.calcs, req.params.calcId);

        user.save(function(err) {
          done(err);
        });
      });
    }
  ], function(err) {
    if (err) return next(err);
    res.end();
  });
};

/**
 * GET '/api/calc/:calcId'
 * Calculator.
 */

exports.getCalc = function(req, res, next) {
  Calc.findById(req.params.calcId, function(err, calc) {
    if (err) return next(err);
    if (calc) {
      if (calc.published) {
        res.send(_.pick(calc, ['doc']));
      } else {
        res.sendStatus(403);
      }
    } else {
      res.sendStatus(404);
    }
  });
};
