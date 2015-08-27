/**
 * Module dependencies.
 */

var bodyParser = require('body-parser');
var compress = require('compression');
var connectAssets = require('connect-assets');
var cookieParser = require('cookie-parser');
// Configure header to be the one used by Angular.
var csrf = require('lusca').csrf({header: 'x-xsrf-token'});
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
var session = require('express-session');

var MongoStore = require('connect-mongo')(session);

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

mongoose.connect(process.env.MONGOLAB_URI, {
  server: {
    socketOptions: {keepAlive: 1}
  },
  replset: {
    socketOptions: {keepAlive: 1}
  }
});
mongoose.connection.on('error', function() {
  console.error('MongoDB Connection Error. Make sure MongoDB is running.');
});

/**
 * Express configuration.
 */

var rootDir = path.join(__dirname, '..');
var clientDir = path.join(rootDir, 'client');

app.set('port', process.env.PORT || 3000);
app.set('views', path.join(clientDir, 'views'));
app.set('view engine', 'jade');
app.use(compress());
app.use(connectAssets({
  paths: [
    path.join(clientDir, 'bower_components'),
    path.join(clientDir, 'js'),
    path.join(clientDir, 'css')
  ],
  helperContext: app.locals,
  compress: false
}));
app.use(logger('dev'));
app.use('/img', express.static(path.join(clientDir, 'img'),
    {maxAge: 3600000}));
app.use('/bower_components',
    express.static(path.join(clientDir, 'bower_components'),
    {maxAge: 3600000}));
app.use('/js', express.static(path.join(clientDir, 'js'),
    {maxAge: 3600000}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(expressValidator());
app.use(cookieParser());
app.use(session({
  resave: true,
  saveUninitialized: true,
  secret: process.env.SESSION_SECRET || 'test',
  store: new MongoStore({
    url: process.env.MONGOLAB_URI,
    auto_reconnect: true
  }),
  cookie: {maxAge: 30 * 24 * 3600000}
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
if (process.env.NODE_ENV !== 'development') {
  app.use(csrf);
  app.use(function(req, res, next) {
    res.cookie('XSRF-TOKEN', res.locals._csrf);
    next();
  });
}
app.use(function(req, res, next) {
  // If there is no fragment in the query params
  // then we're not serving a crawler
  if (req.url.indexOf('?_escaped_fragment_=') == -1) {
    return next();
  }

  /**
   * Serve pre-rendered static page.
   */

  request({
    url: 'http://api.phantomjscloud.com/single/browser/v1/'
        + process.env.PHANTOMJSCLOUD_KEY + '/',
    qs: {
      'requestType': 'raw',
      'targetUrl': 'http://' + process.env.PRERENDER_HOST + req.path
    }
  }, function(err, resPrerendered, body) {
    if (err) {
      console.error(err);
      return res.sendStatus(500);
    }

    var scriptTagRegex = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;

    var stripScriptTags = function(html) {
      return html.replace(scriptTagRegex, '');
    };

    res.send(stripScriptTags(body));
  });
});

/**
 * Main routes.
 */

app.get('/', homeController.index);
app.get('/source/:calcId', homeController.index);
app.get('/calc/:calcId', homeController.index);
app.get('/account', homeController.index);
app.get('/partials/:name', partialsController.partials);
app.post('/api/login', userController.postLogin);
app.get('/api/logout', userController.logout);
app.get('/messages', userController.getMessages);
app.get('/forgot', userController.getForgot);
app.post('/forgot', userController.postForgot);
app.get('/reset/:token', userController.getReset);
app.post('/reset/:token', userController.postReset);
app.post('/api/signup', userController.postSignup);
app.get('/api/account', passportConf.isAuthenticated, userController.getAccount);
app.post('/api/account/email', passportConf.isAuthenticated, userController.postAccountEmail);
app.post('/api/account/password', passportConf.isAuthenticated, userController.postAccountPassword);
app.delete('/api/account', passportConf.isAuthenticated, userController.deleteAccount);
app.get('/api/source/:calcId', passportConf.isAuthenticated, calcController.getSource);
app.post('/api/source/:calcId', passportConf.isAuthenticated, calcController.postSource);
app.delete('/api/source/:calcId', passportConf.isAuthenticated, calcController.deleteSource);
app.get('/api/calc/:calcId', calcController.getCalc);
app.get('/favicon.ico', function(req, res) {
  res.sendFile(path.join(clientDir, 'img/favicon.ico'), {maxAge: 3600000});
});

/**
 * 500 Error Handler.
 */

if (process.env.NODE_ENV === 'development') {
  app.use(errorHandler())
}

/**
 * Start Express server.
 */

app.listen(app.get('port'), function() {
  console.log('Express server listening on port %d in %s mode', app.get('port'),
      app.get('env'));
});

module.exports = app;
