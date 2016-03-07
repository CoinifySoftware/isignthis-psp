var
  request = require('request'),
  sinon = require('sinon'),
  chai = require('chai'),
  chaiSubset = require('chai-subset');

chai.use(chaiSubset);
var should = chai.should();

var ISignThis = require('../../index.js');

var acquirerId = 'clearhaus';
var merchantId = 'merchant_id';
var apiClient = 'api_client';
var authToken = 'auth_token';
var callbackAuthToken = 'callback_auth_token';

// Don't log anything during testing
var log = require('console-log-level')({level: 'fatal'});

describe('_post', function() {

  describe('success', function() {
    var transactionId = "Test";
    var transactionReference = "Coinify Card Verification";

    var responseObject = {
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

    before(function (done) {
      sinon.stub(request, 'post').yields(null, {statusCode: 200}, JSON.stringify(responseObject));
      done();
    });

    after(function (done) {
      request.post.restore();
      done();
    });

    it('should call request.post correctly', function(done) {
      var requestObject = {request: true};

      var iSignThis = new ISignThis({
        acquirerId: acquirerId,
        merchantId: merchantId,
        apiClient: apiClient,
        authToken: authToken,
        callbackAuthToken: callbackAuthToken,
        log: log
      });

      var path = '/path/to/request';

      iSignThis._post(path, requestObject, function(err, obj) {
        if (err) {
          return done(err);
        }

        /* Check request data */
        request.post.calledOnce.should.equal(true);
        var callOptions = request.post.firstCall.args[0];
        callOptions.url.should.equal('https://gateway.isignthis.com' + path);
        callOptions.headers.should.containSubset({'Content-Type': 'application/json'});
        // /* Check authorization headers are included */
        callOptions.headers.From.should.equal(apiClient);
        callOptions.headers.Authorization.should.equal('Bearer ' + authToken);

        done();
      })
    });

  });



  describe('request error', function() {

    before(function (done) {
      sinon.stub(request, 'post').yields(new Error('Some error'));
      done();
    });

    after(function (done) {
      request.post.restore();
      done();
    });

    it('should pass an error object to the callback', function(done) {
      var iSignThis = new ISignThis({
        acquirerId: acquirerId,
        merchantId: merchantId,
        apiClient: apiClient,
        authToken: authToken,
        callbackAuthToken,
        log: log
      });

      iSignThis._post('/some/path', {}, function(err) {
        err.should.not.be.empty;
        err.code.should.equal('provider_error');
        err.message.should.equal('Provider communication error');
        err.cause.message.should.equal('Some error');

        done();
      });

    });
  });

});

describe('_get', function() {

  describe('success', function() {

    var transactionId = "Test";
    var transactionReference = "Coinify Card Verification";

    var responseObject = {
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


    before(function (done) {
      sinon.stub(request, 'get').yields(null, {statusCode: 200}, JSON.stringify(responseObject));
      done();
    });

    after(function (done) {
      request.get.restore();
      done();
    });

    it('should call request.get correctly', function(done) {
      var iSignThis = new ISignThis({
        acquirerId: acquirerId,
        merchantId: merchantId,
        apiClient: apiClient,
        authToken: authToken,
        callbackAuthToken,
        log: log
      });

      var path = '/path/to/request';

      iSignThis._get(path, function(err, obj) {
        if (err) {
          return done(err);
        }

        /* Check request data */
        request.get.calledOnce.should.equal(true);
        var callOptions = request.get.firstCall.args[0];
        callOptions.url.should.equal('https://gateway.isignthis.com' + path);
        callOptions.headers.should.containSubset({'Content-Type': 'application/json'});
        /* Check authorization headers are included */
        callOptions.headers.From.should.equal(apiClient);
        callOptions.headers.Authorization.should.equal('Bearer ' + authToken);

        done();
      })
    });

  });



  describe('request error', function() {

    before(function (done) {
      sinon.stub(request, 'post').yields(new Error('Some error'));
      done();
    });

    after(function (done) {
      request.post.restore();
      done();
    });

    it('should pass an error object to the callback', function(done) {
      var iSignThis = new ISignThis({
        acquirerId: acquirerId,
        merchantId: merchantId,
        apiClient: apiClient,
        authToken: authToken,
        callbackAuthToken,
        log: log
      });

      iSignThis._post('/some/path', {}, function(err) {
        err.should.not.be.empty;
        err.code.should.equal('provider_error');
        err.message.should.equal('Provider communication error');
        err.cause.message.should.equal('Some error');

        done();
      });

    });
  });

});



describe('_convertPaymentObject', function() {

  it('should convert a payment object', function(done) {
    var remotePaymentObject = {
      id: "c97f0bfc-c1ac-46c3-96d8-6605a63d380d",
      uid: "c97f0bfc-c1ac-46c3-96d8-6605a63d380d",
      secret: "f8fd310d-3755-4e63-ae98-ab3629ef245d",
      mode: "registration",
      original_message: {
        merchant_id: merchantId,
        transaction_id: 'txid',
        reference: 'txref'
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
      compound_state: "PENDING.AWAIT_SECRET",
      redirect_url: 'https://verify.isignthis.com/capture/c97f0bfc-c1ac-46c3-96d8-6605a63d380d'
    };

    var iSignThis = new ISignThis({
      acquirerId: acquirerId,
      merchantId: merchantId,
      apiClient: apiClient,
      authToken: authToken,
      callbackAuthToken,
      log: log
    });

    var payment = iSignThis._convertPaymentObject(remotePaymentObject);

    /* Check payment object */
    payment.id.should.equal(remotePaymentObject.id);
    payment.acquirerId.should.equal(acquirerId);
    payment.state.should.equal('pending');
    payment.expiryTime.should.equal(remotePaymentObject.expires_at);
    payment.redirectUrl.should.equal(remotePaymentObject.redirect_url);

    remotePaymentObject.should.containSubset(payment.raw);

    /* Check transactions */
    payment.transactions.length.should.equal(2);
    payment.transactions[0].id.should.equal(remotePaymentObject.transactions[0].bank_id);
    payment.transactions[0].amount.should.equal(70);
    payment.transactions[0].currency.should.equal('DKK');
    payment.transactions[1].id.should.equal(remotePaymentObject.transactions[1].bank_id);
    payment.transactions[1].amount.should.equal(30);
    payment.transactions[1].currency.should.equal('DKK');

    done();
  })

});
