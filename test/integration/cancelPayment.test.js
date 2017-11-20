'use strict';

const
  requestPromise = require('request-promise-native'),
  sinon = require('sinon'),
  chai = require('chai');

chai.use(require('chai-subset'));
chai.use(require('chai-as-promised'));
const expect = chai.expect;
const ISignThis = require('../../index.js');

const acquirerId = 'clearhaus';
const merchantId = 'merchant_id';
const apiClient = 'api_client';
const authToken = 'auth_token';
const callbackAuthToken = 'auth_token';

// Don't log anything during testing
const log = require('console-log-level')({level: 'fatal'});

describe('cancelPayment - INTEGRATION', () => {
  const transactionId = 'Test';

  let iSignThis;
  let requestPostStub;

  beforeEach(() => {
    iSignThis = new ISignThis({
      acquirerId,
      merchantId,
      apiClient,
      authToken,
      callbackAuthToken,
      log
    });

    requestPostStub = sinon.stub(requestPromise, 'post')
      .resolves();
  });

  afterEach(() => {
    requestPostStub.restore();
  });

  it('should cancel payment', async () => {
    await iSignThis.cancelPayment(transactionId);

    // Check request data
    expect(requestPostStub.calledOnce).to.equal(true);
    expect(requestPostStub.firstCall.args[0].url).to.equal(`https://gateway.isignthis.com/v1/authorization/${transactionId}/cancel`);
  });

  it('returns an "invalid_state" error when payment cannot be cancelled', () => {
    const error = {
      code: 'VALIDATION_ERROR',
      message: 'Your request failed validation. Please check your parameters satisfies requirements specified in the API documentation.',
      details: [{id: 'transaction-complete', message: 'Transaction is already final and cant be cancelled'}]
    };
    requestPostStub.rejects({statusCode: 400, error});

    return expect(iSignThis.cancelPayment(123456)).to.eventually
      .be.rejectedWith(error.details[0].message)
      .and.have.property('code', 'invalid_state');
  });
});
