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
  const constructRequestResponse = {transaction: {id: 'tx-id'}};

  let createPaymentArgs, postStub, convertPaymentStub, constructRequestStub;

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
    constructRequestStub = sinon.stub(iSignThis, '_constructPaymentRequestBody')
      .returns(constructRequestResponse);
  });

  afterEach(() => {
    postStub.restore();
    convertPaymentStub.restore();
    constructRequestStub.restore();
  });

  it('should add amount and currency to request body', async () => {
    const payment = await iSignThis.createPayment(createPaymentArgs);
    expect(payment).to.deep.equal(convertPaymentResponse);

    expect(postStub.calledOnce).to.equal(true);
    const [requestUrl, requestBody] = postStub.firstCall.args;
    expect(requestUrl).to.equal('/v1/authorization');
    expect(requestBody).to.containSubset({
      transaction: {
        id: 'tx-id',
        amount: '100.00',
        currency: 'EUR'
      }
    });

    expect(constructRequestStub.calledOnce).to.equal(true);
    expect(constructRequestStub.firstCall.args[0]).to.deep.equal(createPaymentArgs);

    expect(convertPaymentStub.calledOnce).to.equal(true);
    expect(convertPaymentStub.firstCall.args[0]).to.deep.equal(postResponse);
  });

  it('should pass initRecurring to request when provided', async () => {
    createPaymentArgs.initRecurring = true;

    await iSignThis.createPayment(createPaymentArgs);
    const requestBody = postStub.firstCall.args[1];
    expect(requestBody).to.containSubset({
      transaction: {
        id: 'tx-id',
        init_recurring: true
      }
    });
  });
});
