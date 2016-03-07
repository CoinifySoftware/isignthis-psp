var
  request = require('request'),
  sinon = require('sinon'),
  chai = require('chai'),
  chaiSubset = require('chai-subset');

chai.use(chaiSubset);
chai.should();

var ISignThis = require('../../index.js');

var acquirerId = 'clearhaus';
var merchantId = 'merchant_id';
var apiClient = 'api_client';
var authToken = 'auth_token';
var callbackAuthToken = 'auth_token';

// Don't log anything during testing
var log = require('console-log-level')({level: 'fatal'});

describe('cancelPayment', function () {

  var transactionId = "Test";

  var iSignThis;
  var requestPostStub;

  beforeEach(function (done) {
    iSignThis = new ISignThis({
      acquirerId,
      merchantId,
      apiClient,
      authToken,
      callbackAuthToken,
      log
    });

    requestPostStub = sinon.stub(request, 'post').yields(null, {}, null);
    done();
  });

  afterEach(function (done) {
    requestPostStub.restore();
    done();
  });

  describe('success', function () {

    it('correctly sends request and parses response', function (done) {
      requestPostStub.yields(null, {statusCode: 200}, null);

      iSignThis.cancelPayment(transactionId, function (err) {
        if (err) {
          return done(err);
        }

        /* Check request data */
        request.post.calledOnce.should.equal(true);
        request.post.firstCall.args[0].url.should.equal('https://gateway.isignthis.com/v1/authorization/' + transactionId + '/cancel');

        done();
      });
    })

  });

  describe('failure', function () {

    it('returns an "invalid_state" error when payment cannot be cancelled', function (done) {
      var CANNOT_CANCEL_ERROR_RESPONSE_BODY = {error: [{'transaction-complete': 'Transaction is already final and can\'t be cancelled'}]};
      requestPostStub.yields(null, {statusCode: 400}, CANNOT_CANCEL_ERROR_RESPONSE_BODY);

      iSignThis.cancelPayment(123456, function (err) {
        err.should.be.an('Error');
        err.code.should.equal('invalid_state');
        err.message.should.equal(CANNOT_CANCEL_ERROR_RESPONSE_BODY.error[0]['transaction-complete']);

        done();
      });
    });

    it('returns an error when payment could not be found', function (done) {
      requestPostStub.yields(null, {statusCode: 400}, {some: 'body'});

      iSignThis.cancelPayment(123456, function (err) {
        err.should.be.an('Error');
        err.code.should.equal('provider_error');
        err.statusCode.should.equal(400);

        done();
      })
    });

    it('returns an "invalid_state" error when payment cannot be cancelled', function (done) {
      const CANNOT_CANCEL_ERROR_RESPONSE_BODY = {
        "code": "VALIDATION_ERROR",
        "message": "Your request failed validation. Please check your parameters satisfies requirements specified in the API documentation.",
        "details": [{"id": "transaction-complete", "message": "Transaction is already final and cant be cancelled"}]
      };
      requestPostStub.yields(null, {statusCode: 400}, CANNOT_CANCEL_ERROR_RESPONSE_BODY);

      iSignThis.cancelPayment(123456, function (err) {
        err.should.be.an('Error');
        err.code.should.equal('invalid_state');
        err.message.should.equal(CANNOT_CANCEL_ERROR_RESPONSE_BODY.details[0]['message']);
        done();
      });
    });
  });
});