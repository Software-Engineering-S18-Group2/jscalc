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
            //  assert.equals(res.statusCode,200);
            //  console.log(res);
            expect(res.statusCode).to.equal(200);
            //expect(res.body).to.equal('wrong header');
            done();
        });
    });

    // http request fail
    it('should return false', function (done) {
        request.get('http://localhost:3000', function (err, res, body){
            //  assert.equals(res.statusCode,200);
            //  console.log(res);
            assert.notEqual(res.body,"akjsdhkja");
            //expect(res.body).to.equal('wrong header');
            done();
        });
    });

});
