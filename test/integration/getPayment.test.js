'use strict';

const
  requestPromise = require('request-promise-native'),
  sinon = require('sinon'),
  chai = require('chai'),
  chaiSubset = require('chai-subset');

chai.use(chaiSubset);
const expect = chai.expect;

const ISignThis = require('../../index.js');

const acquirerId = 'clearhaus';
const merchantId = 'merchant_id';
const apiClient = 'api_client';
const authToken = 'auth_token';
const callbackAuthToken = 'auth_token';

// Don't log anything during testing
const log = require('console-log-level')({level: 'fatal'});

describe('getPayment - INTEGRATION', () => {
  const iSignThis = new ISignThis({
    acquirerId,
    merchantId,
    apiClient,
    authToken,
    callbackAuthToken,
    log
  });

  const transactionId = 'Test';
  const transactionReference = 'Coinify Card Verification';

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
    compound_state: 'PENDING.AWAIT_SECRET',
    card_reference: {
      card_brand: 'MASTERCARD',
      card_token: 'cardToken',
      masked_pan: '123456...9876',
      expiry_date: '0721'
    }
  };

  let requestGetStub;
  beforeEach(() => {
    requestGetStub = sinon.stub(requestPromise, 'get')
      .resolves(successResponse);
  });

  afterEach(() => {
    requestGetStub.restore();
  });

  it('should get payment and parse response', async () => {
    const payment = await iSignThis.getPayment(successResponse.id);
    expect(payment).to.deep.equal({
      id: 'c97f0bfc-c1ac-46c3-96d8-6605a63d380d',
      acquirerId: 'clearhaus',
      state: 'pending',
      expiryTime: '2016-03-06T13:36:59.196Z',
      redirectUrl: undefined,
      transactions: [
        {
          id: '2774d451-5499-41a6-a37e-6a90f2b8673c',
          amount: 70,
          currency: 'DKK'
        },
        {
          id: '73f63c0b-7c59-416f-89e5-17dcc38b64ac',
          amount: 30,
          currency: 'DKK'
        }
      ],
      kycReviewIncluded: false,
      card: {
        token: 'cardToken',
        brand: 'MASTERCARD',
        expiryDate: '0721',
        bin: '123456',
        last4: '9876'
      },
      raw: successResponse
    });

    expect(requestGetStub.calledOnce).to.equal(true);
    expect(requestGetStub.firstCall.args[0].url).to.equal(`https://gateway.isignthis.com/v1/authorization/${successResponse.id}`);
  });
});
