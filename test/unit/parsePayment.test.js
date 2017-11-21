'use strict';

const expect = require('chai').expect,
  sinon = require('sinon');

const ISignThis = require('../../index.js');

const clientCertificate = '1234',
  clientKey = '2345',
  acquirerId = 'clearhaus',
  merchantId = 'merchant_id',
  apiClient = 'api_client',
  callbackAuthToken = 'callbck_auth_token',
  authToken = 'auth_token';

describe('parsePayment', () => {
  const iSignThis = new ISignThis({
    clientCertificate,
    clientKey,
    acquirerId,
    merchantId,
    apiClient,
    callbackAuthToken,
    authToken
  });

  const convertPaymentResponse = {payment: true};

  let convertPaymentStub;
  beforeEach(() => {
    convertPaymentStub = sinon.stub(iSignThis, '_convertPaymentObject')
      .returns(convertPaymentResponse);
  });

  afterEach(() => {
    convertPaymentStub.restore();
  });

  it('should call parser function and return result', () => {
    const requestBody = {notification: true};
    const payment = iSignThis.parsePayment(requestBody);

    expect(payment).to.deep.equal(convertPaymentResponse);
    expect(convertPaymentStub.calledOnce).to.equal(true);
    expect(convertPaymentStub.firstCall.args[0]).to.deep.equal(requestBody);
  });
});
