const chai = require('chai'),
  sinon = require('sinon'),
  chaiSubset = require('chai-subset');

chai.use(chaiSubset);
const expect = chai.expect;

const ISignThis = require('../../index.js');

describe('createPayment', () => {

  const iSignThis = new ISignThis({
    merchantId: 'merchantId',
    apiClient: 'apiClient',
    authToken: 'authToken',
    callbackAuthToken: 'callbackAuthToken',
    acquirerId: 'clearhaus'
  });

  const postResponse = {response: true};
  const convertPaymentResponse = {payment: true};

  let createPaymentArgs, postStub, convertPaymentStub;

  beforeEach(() => {
    createPaymentArgs = {
      returnUrl: 'www.return.com',
      amount: 10000,
      currency: 'EUR',
      transaction: {
        id: 'tx-id',
        reference: 'CY_1234'
      },
      client: {
        ip: '127.0.0.1',
        name: 'Hans Zimmer',
        dob: '1990-01-30',
        country: 'Denmark',
        email: 'test@email.com',
        address: 'address1'
      },
      account: {
        id: 't_12345',
        secret: 'secret123',
        name: 'Hans Zimmer'
      }
    };

    postStub = sinon.stub(iSignThis, '_post')
      .resolves(postResponse);
    convertPaymentStub = sinon.stub(iSignThis, '_convertPaymentObject')
      .returns(convertPaymentResponse);
  });

  afterEach(() => {
    postStub.restore();
    convertPaymentStub.restore();
  });

  it('should construct request body and call post with all params', async () => {
    const payment = await iSignThis.createPayment(createPaymentArgs);
    expect(payment).to.deep.equal(convertPaymentResponse);

    expect(postStub.calledOnce).to.equal(true);
    const [requestUrl, requestBody] = postStub.firstCall.args;
    expect(requestUrl).to.equal('/v1/authorization');
    expect(requestBody).to.containSubset({
      acquirer_id: 'clearhaus',
      merchant: {
        id: 'merchantId',
        name: 'node-isignthis-psp',
        return_url: 'www.return.com'
      },
      transaction: {
        id: 'tx-id',
        amount: '100.00',
        currency: 'EUR',
        reference: 'CY_1234'
      },
      client: {
        ip: '127.0.0.1',
        name: 'Hans Zimmer',
        dob: '1990-01-30',
        email: 'test@email.com',
        address: 'address1',
        citizen_country: 'Denmark',
        birth_country: 'Denmark'
      },
      account: {
        secret: 'secret123',
        identifier: 't_12345',
        identifier_type: 'ID',
        full_name: 'Hans Zimmer'
      },
      downstream_auth_type: 'bearer',
      downstream_auth_value: 'callbackAuthToken',
      requested_workflow: 'SCA'
    });

    expect(convertPaymentStub.calledOnce).to.equal(true);
    expect(convertPaymentStub.firstCall.args[0]).to.deep.equal(postResponse);
  });

  it('should construct request body and call post with minimum required params', async () => {
    createPaymentArgs = {
      returnUrl: 'www.return.com',
      amount: 10000,
      currency: 'EUR',
      client: {
        ip: '127.0.0.1'
      },
      account: {
        id: 't_12345'
      }
    };

    const payment = await iSignThis.createPayment(createPaymentArgs);
    const requestBody = postStub.firstCall.args[1];
    expect(requestBody).to.containSubset({
      acquirer_id: 'clearhaus',
      merchant: {
        id: 'merchantId',
        name: 'node-isignthis-psp',
        return_url: 'www.return.com'
      },
      transaction: {
        id: '',
        amount: '100.00',
        currency: 'EUR',
        reference: ' '
      },
      client: {
        ip: '127.0.0.1', name: undefined, address: undefined
      },
      account: {
        identifier: 't_12345', identifier_type: 'ID', full_name: '  '
      },
      downstream_auth_type: 'bearer',
      downstream_auth_value: 'callbackAuthToken',
      requested_workflow: 'SCA'
    });
  });

  it('should pass initRecurring to request when provided', async () => {
    createPaymentArgs.initRecurring = true;

    await iSignThis.createPayment(createPaymentArgs);
    const requestBody = postStub.firstCall.args[1];
    expect(requestBody).to.containSubset({
      transaction: {
        id: 'tx-id',
        amount: '100.00',
        currency: 'EUR',
        reference: 'CY_1234',
        init_recurring: true
      }
    });
  });

  it('should pass merchantId and acquirerId to request when provided', async () => {
    createPaymentArgs.merchantId = 'another_merchant_id';
    createPaymentArgs.acquirerId = 'another_acquirer_id';

    await iSignThis.createPayment(createPaymentArgs);
    const requestBody = postStub.firstCall.args[1];
    expect(requestBody).to.containSubset({
      acquirer_id: 'another_acquirer_id',
      merchant: {
        id: 'another_merchant_id',
        name: 'node-isignthis-psp',
        return_url: 'www.return.com'
      }
    });
  });
});
