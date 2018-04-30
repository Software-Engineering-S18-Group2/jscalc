//During the test the env variable is set to test
var assert = require('chai').assert;

var mongoose = require("mongoose");
var expect = require('Chai').expect;
var request = require('request');

//Require the dev-dependencies
var chai = require('chai');
var chaiHttp = require('chai-http');
var server = require('../app');

chai.use(chaiHttp);
//Our parent block
describe('server response', function () {

    // test http request
    it('should return 200', function (done) {
        request.get('http://localhost:3000', function (err, res, body){
            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    // http request fail
    it('should return false', function (done) {
        request.get('http://localhost:3000', function (err, res, body){
            assert.notEqual(res.body,"akjsdhkja");
            done();
        });
    });

    // test content for http request
    it('should return true for terms', function (done) {
        request.get('http://localhost:3000/terms', function (err, res, body){
            var body = res.body;
            assert.isTrue(body.includes("terms") );
            done();
        });
    });
});
