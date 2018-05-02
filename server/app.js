/**
 * Module dependencies.
 */

var bodyParser = require('body-parser');
var compress = require('compression');
var connectAssets = require('connect-assets');
var cookieParser = require('cookie-parser');
// Configure header & cookie to be the ones used by Angular. "secret"
// replaces the default value '_csrfSecret' because that triggers a
// bug in cookie-session.
var csrf = require('lusca').csrf({ angular: true, secret: 'csrfSecret' });
var errorHandler = require('errorhandler');
var express = require('express');
var expressValidator = require('express-validator');
var flash = require('express-flash');
var fs = require('fs');
var logger = require('morgan');
var mongoose = require('mongoose');
var request = require('request');
var passport = require('passport');
var path = require('path');
var session = require('cookie-session');

/**
 * Controllers (route handlers).
 */

var homeController = require('./controllers/home');
var partialsController = require('./controllers/partials');
var userController = require('./controllers/user');
var calcController = require('./controllers/calc');

/**
 * Passport configuration.
 */

var passportConf = require('./passport');

/**
 * Create Express server.
 */

var app = express();

/**
 * Connect to MongoDB.
 */

mongoose.connect("mongodb://localhost:27017/myproject", {
    server: {
        socketOptions: { keepAlive: 1 },
    },
    replset: {
        socketOptions: { keepAlive: 1 },
    },
});
mongoose.connection.on('error', function() {
    console.error('MongoDB Connection Error. Make sure MongoDB is running.');
});

/**
 * Express configuration.
 */

var rootDir = path.join(__dirname, '..');
var clientDir = path.join(rootDir, 'client');

/**
 * Creating Google strategy for code implementation.
 */

var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
//var FacebookStrategy = require('passport-facebook').Strategy;

/*
*   Config file is private.
*    TODO : change the config file after the demo
 */
var googleConfig = {
    clientID     : "554469509258-kfk0bh3sdmfnbp3enkm0oupb9rjrahd2.apps.googleusercontent.com",
    clientSecret : "qDP2haYLXkxoIStL1olubeWf",
    callbackURL  : "http://localhost:3000/auth/google/callback"
};

/*

TODO: For future use facebook strategy.


function facebookStrategy(token,refreshToken,profile,done){
    userModel.findUserByFacebookId(profile.id)
        .then(function (user) {
            if(user){
                return done(null,user);
            }
            else{
                var newUser = {
                    username: profile.displayName.replace(/ /g,""),
                    facebook:{
                        token:token,
                        id:profile.id
                    }
                };
                userModel
                    .createUser(newUser)
                    .then(function (user) {
                        return done(null,user);
                    },function (error) {
                        return done(error,null);
                    });
            }
        },function (error) {
            return done(error,null);
        });
}

 */

app.set('port', process.env.PORT || 3000);
app.set('views', path.join(clientDir, 'views'));
app.set('view engine', 'jade');
app.use(compress());
app.use(
    connectAssets({
        paths: [
            path.join(clientDir, 'bower_components'),
            path.join(clientDir, 'js'),
            path.join(clientDir, 'css'),
        ],
        helperContext: app.locals,
        compress: false,
    })
);
app.use(logger('dev'));
app.use(
    '/img',
    express.static(path.join(clientDir, 'img'), { maxAge: 3600000 })
);
app.use(
    '/bower_components',
    express.static(path.join(clientDir, 'bower_components'), { maxAge: 3600000 })
);
app.use('/js', express.static(path.join(clientDir, 'js'), { maxAge: 3600000 }));
app.use(
    '/html',
    express.static(path.join(clientDir, 'html'), { maxAge: 3600000 })
);
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }));
app.use(expressValidator());
app.use(cookieParser());
app.use(
    session({
        secret: process.env.SESSION_SECRET || 'test',
        maxAge: 30 * 24 * 3600000,
        signed: false,
    })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
if (process.env.NODE_ENV !== 'development') {
    app.use(csrf);
}

var maybeServeMetatags = function(req, res, next) {
    if (
        req.headers['user-agent'].toLowerCase().indexOf('facebookexternalhit') == -1
    ) {
        return next();
    }
    return homeController.getCalcMetaTags(req, res, next);
};

var maybePrerender = function(req, res, next) {
    // Disabling pre-rendering because phantomjscloud.com produces an error about
    // insufficient credits. This needs further investigation - maybe the app
    // really runs out of credit, or maybe we're calling their API incorrectly.
    // For now it's best to disable pre-rendering because it will make sure
    // the app is listed correctly in Google Search results, and the negative
    // effect will only be on other search engines.
    return next();

    // If there is no fragment in the query params
    // then we're not serving a crawler
    if (req.url.indexOf('?_escaped_fragment_=') == -1) {
        return next();
    }

    /**
     * Serve pre-rendered static page.
     */

    request(
        {
            url:
            'http://api.phantomjscloud.com/single/browser/v1/' +
            process.env.PHANTOMJSCLOUD_KEY +
            '/',
            qs: {
                requestType: 'raw',
                targetUrl: 'http://' + process.env.PRERENDER_HOST + req.path,
            },
        },
        function(err, resPrerendered, body) {
            if (err) {
                console.error(err);
                return res.sendStatus(500);
            }

            var scriptTagRegex = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;

            var stripScriptTags = function(html) {
                return html.replace(scriptTagRegex, '');
            };

            res.send(
                stripScriptTags(body).replace('<meta name="fragment" content="!">', '')
            );
        }
    );
};

/**
 * Main routes.
 */

app.use(function (req, res, next) {
// res.header("Access-Control-Allow-Origin", "*");
// Asgn 6 - replace above line with this
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
// Asgn - 6
    res.header("Access-Control-Allow-Credentials", "true");
    next();
});

app.get('/', maybePrerender, homeController.index);
app.get('/source/:calcId', maybePrerender, homeController.index);
app.get(
    '/calc/:calcId',
    maybeServeMetatags,
    maybePrerender,
    homeController.index
);
app.get('/embed/:calcId', maybePrerender, homeController.index);
app.get('/account', maybePrerender, homeController.index);
app.get('/terms', maybePrerender, homeController.index);
app.get('/privacy', maybePrerender, homeController.index);
app.get('/partials/:name', partialsController.partials);
app.post('/api/login', userController.postLogin);
app.get('/auth/google', passport.authenticate('google', { scope : ['profile', 'email'] }));
app.get('/api/logout', userController.logout);
app.get('/messages', userController.getMessages);
app.get('/forgot', userController.getForgot);
app.post('/forgot', userController.postForgot);
app.get('/reset/:token', userController.getReset);
app.post('/reset/:token', userController.postReset);
app.post('/api/signup', userController.postSignup);
// PUT instead of GET to enable csrf check, needed to prevent requests from web worker.

app.put(
    '/api/account',
    passportConf.isAuthenticated,
    userController.getAccount
);
app.post(
    '/api/account/email',
    passportConf.isAuthenticated,
    userController.postAccountEmail
);
app.post(
    '/api/account/password',
    passportConf.isAuthenticated,
    userController.postAccountPassword
);
app.delete(
    '/api/account',
    passportConf.isAuthenticated,
    userController.deleteAccount
);
app.get(
    '/api/source/:calcId',
    passportConf.isAuthenticated,
    calcController.getSource
);
app.post(
    '/api/source/:calcId',
    passportConf.isAuthenticated,
    calcController.postSource
);
app.delete(
    '/api/source/:calcId',
    passportConf.isAuthenticated,
    calcController.deleteSource
);
app.get('/api/calc/:calcId', calcController.getCalc);
app.get('/favicon.ico', function(req, res) {
    res.sendFile(path.join(clientDir, 'img/favicon.ico'), { maxAge: 3600000 });
});
app.get('/auth/google/callback',
    passport.authenticate('google', {
        successRedirect: '/account',
        failureRedirect: '/'
    }));


passport.use(new GoogleStrategy(googleConfig, userController.googleStrategy));
/**
 * 500 Error Handler.
 */

if (process.env.NODE_ENV === 'development') {
    app.use(errorHandler());
}

/**
 * Start Express server.
 */

app.listen(app.get('port'), function() {
    console.log(
        'Express server listening on port %d in %s mode',
        app.get('port'),
        app.get('env')
    );
});

module.exports = app;
