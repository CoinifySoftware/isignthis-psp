'use strict';

const
  request = require('request'),
  sinon = require('sinon'),
  chai = require('chai'),
  chaiSubset = require('chai-subset');

chai.use(chaiSubset);
const should = chai.should();

const ISignThis = require('../../index.js');

const acquirerId = 'clearhaus';
const merchantId = 'merchant_id';
const apiClient = 'api_client';
const authToken = 'auth_token';
const callbackAuthToken = 'callback_auth_token';

// Don't log anything during testing
const log = require('console-log-level')({level: 'fatal'});

describe('createPayment', () => {
  const transactionId = 'Test';
  const transactionReference = 'Coinify Card Verification';
  let iSignThis;

  const successResponse = {
    id: 'c97f0bfc-c1ac-46c3-96d8-6605a63d380d',
    uid: 'c97f0bfc-c1ac-46c3-96d8-6605a63d380d',
    secret: 'f8fd310d-3755-4e63-ae98-ab3629ef245d',
    mode: 'registration',
    original_message: {
      merchant_id: merchantId,
      transaction_id: transactionId,
      reference: transactionReference
    },
    expires_at: '2016-03-06T13:36:59.196Z',
    transactions: [
      {
        acquirer_id: acquirerId,
        bank_id: '2774d451-5499-41a6-a37e-6a90f2b8673c',
        response_code: '20000',
        success: true,
        amount: '0.70',
        currency: 'DKK',
        message_class: 'authorization-and-capture',
        status_code: '20000'
      },
      {
        acquirer_id: acquirerId,
        bank_id: '73f63c0b-7c59-416f-89e5-17dcc38b64ac',
        response_code: '20000',
        success: true,
        amount: '0.30',
        currency: 'DKK',
        message_class: 'authorization-and-capture',
        status_code: '20000'
      }
    ],
    state: 'PENDING',
    compound_state: 'PENDING.AWAIT_SECRET'
  };

  beforeEach((done) => {
    iSignThis = new ISignThis({
      acquirerId,
      merchantId,
      apiClient,
      authToken,
      callbackAuthToken,
      log
    });

    sinon.stub(request, 'post').yields(null, {statusCode: 201}, JSON.stringify(successResponse));
    done();
  });

  afterEach((done) => {
    request.post.restore();
    done();
  });

  describe('minimal success request/response', () => {
    it('correctly sends request and parses response', (done) => {
      const returnUrl = 'https://coinify.com/payment-return';

      const createPaymentOptions = {
        returnUrl,
        amount: 5000,
        currency: 'DKK', // 50.00 DKK
        client: {
          ip: '127.0.0.1',
          userAgent: 'Mozilla/5.0 (iPad; U; CPU OS 3_2_1 like Mac OS X; en-us) AppleWebKit/531...'
        },
        account: {
          id: 'accountId'
        }
      };

      const minimalExpectedRequestObject = {
        acquirer_id: acquirerId,
        merchant: {
          id: merchantId, // our merchant at IST
          name: 'node-isignthis-psp', // our internal user name
          return_url: returnUrl
        },
        transaction: {
          id: '',
          amount: '50.00',
          currency: 'DKK',
          reference: ' '
        },
        client: {
          ip: createPaymentOptions.client.ip,
          address: undefined,
          citizen_country: undefined,
          birth_country: undefined,
          name: undefined
        },
        account: {
          identifier_type: 'ID',
          identifier: createPaymentOptions.account.id,
          // String with two spaces (min length) because no account.name passed
          full_name: '  '

        },
        downstream_auth_type: 'bearer',
        downstream_auth_value: callbackAuthToken,
        requested_workflow: 'SCA'
      };

      iSignThis.createPayment(createPaymentOptions, (err, payment) => {
        if (err) {
          return done(err);
        }

        /* Check request data */
        request.post.calledOnce.should.equal(true);
        request.post.firstCall.args[0].json.should.containSubset(minimalExpectedRequestObject);

        /* Briefly check payment object. See test for _convertPaymentObject() for full coverage */
        payment.id.should.equal(successResponse.id);

        done();
      });
    });
  });

  describe('complete success request/response', () => {
    it('correctly sends request and parses response', (done) => {
      const returnUrl = 'https://coinify.com/payment-return';
      const token = 'theBestTokenInZUniverse';

      const createPaymentOptions = {
        acquirerId: 'another_acquirer',
        returnUrl,
        amount: 5000,
        currency: 'DKK', // 50.00 DKK
        client: {
          ip: '127.0.0.1',
          userAgent: 'Mozilla/5.0 (iPad; U; CPU OS 3_2_1 like Mac OS X; en-us) AppleWebKit/531...',
          dob: '1970-01-01',
          country: 'DK',
          email: 'test@coinify.com',
          address: '123 Example street, 4321 Example City'
        },
        account: {
          id: 'accountId',
          secret: 'the-specific-secret',
          name: 'John Doe'
        },
        transaction: {
          id: 'tx-id',
          reference: 'tx-reference'
        },
        card: {
          token
        }
      };

      const minimalExpectedRequestObject = {
        acquirer_id: createPaymentOptions.acquirerId,
        merchant: {
          id: merchantId, // our merchant at IST
          name: 'node-isignthis-psp', // our internal user name
          return_url: returnUrl
        },
        transaction: {
          id: createPaymentOptions.transaction.id,
          amount: '50.00',
          currency: 'DKK',
          reference: createPaymentOptions.transaction.reference
        },
        client: {
          ip: createPaymentOptions.client.ip,
          email: createPaymentOptions.client.email,
          address: createPaymentOptions.client.address,
          dob: createPaymentOptions.client.dob,
          citizen_country: createPaymentOptions.client.country,
          birth_country: createPaymentOptions.client.country,
          name: undefined
        },
        account: {
          identifier_type: 'ID',
          identifier: createPaymentOptions.account.id,
          secret: createPaymentOptions.account.secret,
          full_name: createPaymentOptions.account.name
        },
        requested_workflow: 'SCA',
        cardholder: {
          card_token: token
        }
      };

      iSignThis.createPayment(createPaymentOptions, (err, payment) => {
        if (err) {
          return done(err);
        }

        /* Check request data */
        request.post.calledOnce.should.equal(true);
        request.post.firstCall.args[0].json.should.containSubset(minimalExpectedRequestObject);

        /* Briefly check payment object. See test for _convertPaymentObject() for full coverage */
        payment.id.should.equal(successResponse.id);

        done();
      });
    });

    it('correctly sends request and parses response with merchant_id passed in options', (done) => {
      const returnUrl = 'https://coinify.com/payment-return';

      const createPaymentOptions = {
        merchantId: 'another_merchant',
        acquirerId: 'another_acquirer',
        returnUrl,
        amount: 5000,
        currency: 'DKK', // 50.00 DKK
        client: {
          ip: '127.0.0.1',
          userAgent: 'Mozilla/5.0 (iPad; U; CPU OS 3_2_1 like Mac OS X; en-us) AppleWebKit/531...',
          dob: '1970-01-01',
          country: 'DK',
          email: 'test@coinify.com',
          address: '123 Example street, 4321 Example City'
        },
        account: {
          id: 'accountId',
          secret: 'the-specific-secret',
          name: 'John Doe'
        },
        transaction: {
          id: 'tx-id',
          reference: 'tx-reference'
        }
      };

      const minimalExpectedRequestObject = {
        acquirer_id: createPaymentOptions.acquirerId,
        merchant: {
          id: createPaymentOptions.merchantId, // our merchant at IST
          name: 'node-isignthis-psp', // our internal user name
          return_url: returnUrl
        },
        transaction: {
          id: createPaymentOptions.transaction.id,
          amount: '50.00',
          currency: 'DKK',
          reference: createPaymentOptions.transaction.reference
        },
        client: {
          ip: createPaymentOptions.client.ip,
          email: createPaymentOptions.client.email,
          address: createPaymentOptions.client.address,
          dob: createPaymentOptions.client.dob,
          name: undefined
        },
        account: {
          identifier_type: 'ID',
          identifier: createPaymentOptions.account.id,
          secret: createPaymentOptions.account.secret,
          full_name: createPaymentOptions.account.name
        },
        requested_workflow: 'SCA'
      };

      iSignThis.createPayment(createPaymentOptions, (err, payment) => {
        if (err) {
          return done(err);
        }

        /* Check request data */
        request.post.calledOnce.should.equal(true);
        request.post.firstCall.args[0].json.should.containSubset(minimalExpectedRequestObject);

        /* Briefly check payment object. See test for _convertPaymentObject() for full coverage */
        payment.id.should.equal(successResponse.id);

        done();
      });
    });
  });
});
