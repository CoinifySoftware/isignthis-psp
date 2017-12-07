const chai = require('chai'),
  sinon = require('sinon'),
  requestPromise = require('request-promise-native'),
  chaiSubset = require('chai-subset');

chai.use(chaiSubset);
const expect = chai.expect;
const ISignThis = require('../../index.js');

const acquirerId = 'clearhaus';
const merchantId = 'merchant_id';
const apiClient = 'api_client';
const authToken = 'auth_token';
const callbackAuthToken = 'callback_auth_token';

// Don't log anything during testing
const log = require('console-log-level')({level: 'fatal'});

describe('createPayment - INTEGRATION', () => {
  const iSignThis = new ISignThis({
    acquirerId, merchantId, apiClient,
    authToken, callbackAuthToken, log
  });

  const successResponse = {
    id: '48c72c5b-b618-4ccc-9419-88f17536dde0',
    uid: '48c72c5b-b618-4ccc-9419-88f17536dde0',
    secret: '603d2a22-96cf-4248-9d78-042938472006',
    context_uid: '48c72c5b-b618-4ccc-9419-88f17536dde0',
    mode: 'registration',
    original_message: {
      merchant_id: 'Coinify.com',
      transaction_id: 'tx-123',
      reference: 'test'
    },
    transactions: [],
    state: 'PENDING',
    compound_state: 'PENDING.VALIDATED_TRANSACTION',
    redirect_url: 'https://stage-verify.isignthis.com/landing/48c72c5b-b618-4ccc-9419-88f17536dde0'
  };

  let requestStub;
  beforeEach(() => {
    requestStub = sinon.stub(requestPromise, 'post')
      .resolves(successResponse);
  });

  afterEach(() => {
    requestStub.restore();
  });

  it('should construct, send and parse response', async () => {
    const returnUrl = 'https://coinify.com/payment-return';

    const createPaymentOptions = {
      workflow: 'CORE',
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

    const payment = await iSignThis.createPayment(createPaymentOptions);

    // Check request data
    expect(requestStub.calledOnce).to.equal(true);
    expect(requestStub.firstCall.args[0]).to.containSubset({
      body: {
        workflow: 'CORE',
        acquirer_id: 'clearhaus',
        merchant: {
          id: merchantId,
          name: 'node-isignthis-psp',
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
          name: undefined,
          address: undefined
        },
        account: {
          identifier: createPaymentOptions.account.id,
          identifier_type: 'ID',
          full_name: '  '
        },
        downstream_auth_type: 'bearer',
        downstream_auth_value: callbackAuthToken,
        requested_workflow: 'SCA'
      },
      json: true,
      url: 'https://gateway.isignthis.com/v1/authorization',
      headers: {
        'Content-Type': 'application/json',
        From: 'api_client',
        Authorization: 'Bearer auth_token'
      }
    });

    // Check response
    expect(payment).to.deep.equal({
      id: successResponse.id,
      state: 'pending',
      acquirerId: undefined,
      expiryTime: undefined,
      redirectUrl: 'https://stage-verify.isignthis.com/landing/48c72c5b-b618-4ccc-9419-88f17536dde0',
      transactions: [],
      kycReviewIncluded: false,
      card: {},
      raw: successResponse
    });
  });
});
