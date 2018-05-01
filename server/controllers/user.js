var _ = require('lodash');
var async = require('async');
var crypto = require('crypto');
var nodemailer = require('nodemailer');
var passport = require('passport');
var User = require('../models/User');
// var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
// //var FacebookStrategy = require('passport-facebook').Strategy;
//
// var googleConfig = {
//     clientID     : "554469509258-kfk0bh3sdmfnbp3enkm0oupb9rjrahd2.apps.googleusercontent.com",
//     clientSecret : "qDP2haYLXkxoIStL1olubeWf",
//     callbackURL  : "http://localhost:3000/auth/google/callback"
// };
//passport.use(new GoogleStrategy(googleConfig, googleStrategy));



/**
 * POST /login
 * Sign in using email and password.
 * @param email
 * @param password
 */

exports.postLogin = function(req, res, next) {
  req.assert('email', 'Email is not valid').isEmail();
  req.assert('password', 'Password cannot be blank').notEmpty();

  var errors = req.validationErrors();

  if (errors) {
    return res.status(400).send(errors[0].msg);
  }

  passport.authenticate('local', function(err, user, info) {
    if (err) return next(err);
    if (!user) {
      return res.status(400).send(info.message);
    }
    req.logIn(user, function(err) {
      if (err) return next(err);
      res.end();
    });
  })(req, res, next);
};

exports.postLoginWithGoogle = function (req,res,next) {
    console.log("in server side");



}



exports.googleStrategy= function(token, refreshToken, profile, done) {
    console.log("hiii",profile);
    User
        .findOne({'google.id': profile.id})
        .then(
            function(user) {
                if(user) {
                    return done(null, user);
                } else {
                    var email = profile.emails[0].value;
                    var emailParts = email.split("@");
                    var newGoogleUser = {
                        email:     email,
                        google: {
                            id:    profile.id,
                            token: token
                        }
                    };
                    return User.save(newGoogleUser);
                }
            },
            function(err) {
                if (err) { return done(err); }
            }
        )
        .then(
            function(user){
                return done(null, user);
            },
            function(err){
                if (err) { return done(err); }
            }
        );
}






















/**
 * GET /logout
 * Log out.
 */

exports.logout = function(req, res) {
  req.logout();
  res.end();
};

/**
 * POST /signup
 * Create a new local account.
 * @param email
 * @param password
 */

exports.postSignup = function(req, res, next) {
  req.assert('email', 'Email is not valid').isEmail();
  req.assert('password', 'Password must be at least 4 characters long').len(4);
  req.assert('confirmPassword', 'Passwords do not match').
      equals(req.body.password);

  var errors = req.validationErrors();

  if (errors) {
    return res.status(400).send(errors[0].msg);
  }

  var user = new User({
    email: req.body.email,
    password: req.body.password
  });

  User.findOne({email: req.body.email}, function(err, existingUser) {
    if (existingUser) {
      return res.status(400).send('Account with that email address already exists.');
    }
    user.save(function(err) {
      if (err) return next(err);
      req.logIn(user, function(err) {
        if (err) return next(err);
        res.end();
      });
    });
  });
};

/**
 * GET /account
 * Account data.
 */

exports.getAccount = function(req, res, next) {
  User.findById(req.user.id).
  // Mongoose will drop from the list those calculators that do not exist.
  populate('calcs', 'doc.name').
  exec(function(err, user) {
    if (err) return next(err);
    if (!user) return res.sendStatus(404);
    res.send({calcs: user.calcs, email: user.email});
  });
};

/**
 * POST /account/email
 * Update account email.
 * @param email
 */

exports.postAccountEmail = function(req, res, next) {
  User.findById(req.user.id, function(err, user) {
    if (err) return next(err);

    req.assert('email', 'Email is not valid').isEmail();

    var errors = req.validationErrors();

    if (errors) {
      return res.status(400).send(errors[0].msg);
    }

    User.findOne({email: req.body.email}, function(err, existingUser) {
      if (existingUser) {
        return res.status(400).send('Account with that email address already exists.');
      }

      user.email = req.body.email;

      user.save(function(err) {
        if (err) return next(err);
        res.end();
      });
    });
  });
};

/**
 * POST /account/password
 * Update account password.
 * @param oldPassword
 * @param newPassword
 */

exports.postAccountPassword = function(req, res, next) {
  req.assert('oldPassword', 'Old password cannot be blank').notEmpty();
  req.assert('newPassword', 'New password must be at least 4 characters long').len(4);
  req.assert('confirmPassword', 'Passwords do not match').
      equals(req.body.newPassword);

  var errors = req.validationErrors();

  if (errors) {
    return res.status(400).send(errors[0].msg);
  }

  async.waterfall([
    function(done) {
      User.findById(req.user.id, function(err, user) {
        user.comparePassword(req.body.oldPassword, function(err, isMatch) {
          if (err) return done(err);
          if (!isMatch) {
            return res.status(400).send('Old password is incorrect.');
          }
          done(null, user);
        });
      });
    },
    function(user, done) {
      user.password = req.body.newPassword;

      user.save(function(err) {
        done(err);
      });
    }
  ], function(err) {
    if (err) return next(err);
    res.end();
  });
};

/**
 * DELETE /account
 * Delete user account.
 */

exports.deleteAccount = function(req, res, next) {
  User.remove({ _id: req.user.id }, function(err) {
    if (err) return next(err);
    req.logout();
    res.end();
  });
};

/**
 * GET /messages
 * Page used only to display flash messages.
 */

exports.getMessages = function(req, res) {
  res.render('messages');
};

/**
 * GET /reset/:token
 * Reset Password page.
 */

exports.getReset = function(req, res) {
  if (req.isAuthenticated()) {
    return res.redirect('/');
  }
  User
    .findOne({ resetPasswordToken: req.params.token })
    .where('resetPasswordExpires').gt(Date.now())
    .exec(function(err, user) {
      if (!user) {
        req.flash('errors', { msg: 'Password reset token is invalid or has expired.' });
        return res.redirect('/forgot');
      }
      res.render('reset', {
        title: 'Password Reset'
      });
    });
};

/**
 * POST /reset/:token
 * Process the reset password request.
 * @param token
 */

exports.postReset = function(req, res, next) {
  req.assert('password', 'Password must be at least 4 characters long.').len(4);
  req.assert('confirm', 'Passwords must match.').optional().equals(req.body.password);

  var errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('back');
  }

  async.waterfall([
    function(done) {
      User
        .findOne({ resetPasswordToken: req.params.token })
        .where('resetPasswordExpires').gt(Date.now())
        .exec(function(err, user) {
          if (!user) {
            req.flash('errors', {msg: 'Password reset token is invalid or has expired.'});
            return res.redirect('back');
          }

          user.password = req.body.password;
          user.resetPasswordToken = undefined;
          user.resetPasswordExpires = undefined;

          user.save(function(err) {
            if (err) return done(err);
            req.logIn(user, function(err) {
              done(err, user);
            });
          });
        });
    },
    function(user, done) {
      var transporter = nodemailer.createTransport({
        service: 'SendGrid',
        auth: {
          user: process.env.SENDGRID_USER,
          pass: process.env.SENDGRID_PASSWORD
        }
      });
      var mailOptions = {
        to: user.email,
        from: 'no-reply@jscalc.io',
        subject: 'Your JSCalc.io password has been changed',
        text: 'Hello,\n\n' +
          'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
      };
      transporter.sendMail(mailOptions, function(err) {
        req.flash('success', {msg: 'Success! Your password has been changed.'});
        done(err);
      });
    }
  ], function(err) {
    if (err) return next(err);
    res.redirect('/messages');
  });
};

/**
 * GET /forgot
 * Forgot Password page.
 */

exports.getForgot = function(req, res) {
  if (req.isAuthenticated()) {
    return res.redirect('/');
  }
  res.render('forgot', {
    title: 'Forgot Password'
  });
};

/**
 * POST /forgot
 * Create a random token, then send user an email with a reset link.
 * @param email
 */

exports.postForgot = function(req, res, next) {
  req.assert('email', 'Please enter a valid email address.').isEmail();

  var errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/forgot');
  }

  async.waterfall([
    function(done) {
      crypto.randomBytes(16, function(err, buf) {
        var token = buf.toString('hex');
        done(err, token);
      });
    },
    function(token, done) {
      User.findOne({ email: req.body.email.toLowerCase() }, function(err, user) {
        if (!user) {
          req.flash('errors', { msg: 'No account with that email address exists.' });
          return res.redirect('/forgot');
        }

        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        user.save(function(err) {
          done(err, token, user);
        });
      });
    },
    function(token, user, done) {
      var transporter = nodemailer.createTransport({
        service: 'SendGrid',
        auth: {
          user: process.env.SENDGRID_USER,
          pass: process.env.SENDGRID_PASSWORD
        }
      });
      var mailOptions = {
        to: user.email,
        from: 'no-reply@jscalc.io',
        subject: 'Reset your password on JSCalc.io',
        text: 'You are receiving this email because you (or someone else) have requested the reset of the password for your account.\n\n' +
          'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
          'https://' + req.headers.host + '/reset/' + token + '\n\n' +
          'If you did not request this, please ignore this email and your password will remain unchanged.\n'
      };
      transporter.sendMail(mailOptions, function(err) {
        req.flash('info', { msg: 'An e-mail has been sent to ' + user.email + ' with further instructions.' });
        done(err, 'done');
      });
    }
  ], function(err) {
    if (err) return next(err);
    res.redirect('/messages');
  });
};
