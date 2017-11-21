const chai = require('chai'),
  sinon = require('sinon'),
  chaiSubset = require('chai-subset');

chai.use(chaiSubset);
const expect = chai.expect;

const ISignThis = require('../../index.js');

describe('getPayment', () => {

  const iSignThis = new ISignThis({
    merchantId: 'merchantId',
    apiClient: 'apiClient',
    authToken: 'authToken',
    callbackAuthToken: 'callbackAuthToken',
    acquirerId: 'clearhaus'
  });

  const getResponse = {response: true};
  const convertPaymentResponse = {payment: true};

  let createPaymentArgs, getStub, convertPaymentStub;

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

    getStub = sinon.stub(iSignThis, '_get')
      .resolves(getResponse);
    convertPaymentStub = sinon.stub(iSignThis, '_convertPaymentObject')
      .returns(convertPaymentResponse);
  });

  afterEach(() => {
    getStub.restore();
    convertPaymentStub.restore();
  });

  it('should get payment when id is provided', async () => {
    const paymentId = 'tx-id';
    const payment = await iSignThis.getPayment(paymentId);
    expect(payment).to.deep.equal(convertPaymentResponse);

    expect(getStub.calledOnce).to.equal(true);
    const [requestUrl] = getStub.firstCall.args;
    expect(requestUrl).to.equal(`/v1/authorization/${paymentId}`);
    expect(convertPaymentStub.calledOnce).to.equal(true);
    expect(convertPaymentStub.firstCall.args[0]).to.deep.equal(getResponse);
  });

  it('should get payment when object with raw.id is provided', async () => {
    const paymentObject = {
      raw: {
        id: 'tx-id'
      }
    };
    const payment = await iSignThis.getPayment(paymentObject);
    const [requestUrl] = getStub.firstCall.args;
    expect(requestUrl).to.equal(`/v1/authorization/${paymentObject.raw.id}`);
  });
});
