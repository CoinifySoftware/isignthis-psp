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

describe('getPayment', function () {

  var transactionId = "Test";
  var transactionReference = "Coinify Card Verification";

  var iSignThis;
  var requestGetStub;

  var successResponse = {
    id: "c97f0bfc-c1ac-46c3-96d8-6605a63d380d",
    uid: "c97f0bfc-c1ac-46c3-96d8-6605a63d380d",
    secret: "f8fd310d-3755-4e63-ae98-ab3629ef245d",
    mode: "registration",
    original_message: {
      merchant_id: merchantId,
      transaction_id: transactionId,
      reference: transactionReference
    },
    expires_at: "2016-03-06T13:36:59.196Z",
    transactions: [
      {
        acquirer_id: acquirerId,
        bank_id: "2774d451-5499-41a6-a37e-6a90f2b8673c",
        response_code: "20000",
        success: true,
        amount: "0.70",
        currency: "DKK",
        message_class: "authorization-and-capture",
        status_code: "20000"
      },
      {
        acquirer_id: acquirerId,
        bank_id: "73f63c0b-7c59-416f-89e5-17dcc38b64ac",
        response_code: "20000",
        success: true,
        amount: "0.30",
        currency: "DKK",
        message_class: "authorization-and-capture",
        status_code: "20000"
      }
    ],
    state: "PENDING",
    compound_state: "PENDING.AWAIT_SECRET"
  };

  beforeEach(function (done) {
    iSignThis = new ISignThis({
      acquirerId: acquirerId,
      merchantId: merchantId,
      apiClient: apiClient,
      authToken: authToken,
      callbackAuthToken,
      log: log
    });

    requestGetStub = sinon.stub(request, 'get').yields(null, {}, JSON.stringify(successResponse));
    done();
  });

  afterEach(function (done) {
    requestGetStub.restore();
    done();
  });

  describe('success', function () {

    it('correctly sends request and parses response', function (done) {
      requestGetStub.yields(null, {statusCode: 200}, JSON.stringify(successResponse));

      iSignThis.getPayment(successResponse.id, function (err, payment) {
        if (err) {
          return done(err);
        }

        /* Check request data */
        request.get.calledOnce.should.equal(true);
        request.get.firstCall.args[0].url.should.equal('https://gateway.isignthis.com/v1/authorization/' + successResponse.id);

        /* Briefly check payment object. See test for _convertPaymentObject() for full coverage */
        payment.id.should.equal(successResponse.id);

        done();
      });
    })

  });

  describe('failure', function() {

    it('returns an error when payment could not be found', function(done) {
      requestGetStub.yields(null, {statusCode: 404}, {some: 'body'});

      iSignThis.getPayment(123456, function(err, payment) {
        err.should.be.an('Error');
        err.code.should.equal('provider_error');
        err.statusCode.should.equal(404);

        (typeof payment === 'undefined').should.equal(true);

        done();
      })


    });

  });


});
