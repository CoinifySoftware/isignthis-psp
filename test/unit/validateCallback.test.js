/**
 * Created by mbn on 02/05/16.
 */
var
  request = require('request'),
  sinon = require('sinon'),
  chai = require('chai'),
  chaiSubset = require('chai-subset');

chai.use(chaiSubset);
var should = chai.should();

var ISignThis = require('../../index.js');

var clientCertificate = '1234';
var clientKey = '2345';
var acquirerId = 'clearhaus';
var merchantId = 'merchant_id';
var apiClient = 'api_client';
var authToken = 'auth_token';
var callbackAuthToken = 'callback_auth_token';

// Don't log anything during testing
var log = require('console-log-level')({level: 'fatal'});

describe('validateCallback', function () {

  var iSignThis;

  before(function () {
    iSignThis = new ISignThis({
      clientCertificate: clientCertificate,
      clientKey: clientKey,
      acquirerId: acquirerId,
      merchantId: merchantId,
      apiClient: apiClient,
      authToken: authToken,
      callbackAuthToken,
      log: log
    });
  });

  it('should validate request when the right authorization token is provided', function (done) {

    var request = {
      headers: {
        host: 'localhost:8221',
        authorization: 'Bearer '+callbackAuthToken,
        'content-type': 'application/json',
        'content-length': '9',
        connection: 'close'
      }
    };

    iSignThis.validateCallback(request, function (err, result) {
      if (err) {
        return done(err);
      }

      var expectedResult = {
        success: true,
        message: 'Callback is valid'
      };

      result.should.deep.equal(expectedResult);

      done();
    });
  });

  it('should not validate request when the wrong authorization token is provided', function (done) {

    var request = {
      headers: {
        host: 'localhost:8221',
        authorization: 'Bearer wrongtoken',
        'content-type': 'application/json',
        'content-length': '9',
        connection: 'close'
      }
    };

    iSignThis.validateCallback(request, function (err, result) {
      if (err) {
        return done(err);
      }

      var expectedResult = {
        success: false,
        message: 'Callback is invalid'
      };

      result.should.deep.equal(expectedResult);

      done();
    });
  });

  it('should not validate request when no authorization token is provided', function (done) {

    var request = {
      headers: {
        host: 'localhost:8221',
        'content-type': 'application/json',
        'content-length': '9',
        connection: 'close'
      }
    };

    iSignThis.validateCallback(request, function (err) {

      err.should.be.an('error');
      err.message.should.equal('Authorization header missing');

      done();
    });
  });

});
