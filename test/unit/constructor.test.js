'use strict';

const expect = require('chai').expect;

const ISignThis = require('../../index.js');

describe('Constructor', () => {
  it('should throw an error on missing client certificate and merchant name', () => {
    let fn = () => {
      const iSignThis = new ISignThis({
      // Missing merchant id
        apiClient: 'api_client',
        authToken: 'auth_token'
      });
    };

    expect(fn).to.throw(Error, 'Missing configuration options');

    fn = () => {
      const iSignThis = new ISignThis({
      // Missing client certificate
        apiClient: 'api_client',
        merchantId: 'merchant_id'
      });
    };

    expect(fn).to.throw(Error, 'Missing configuration options');

    fn = () => {
      const iSignThis = new ISignThis({
      // Missing client key
        authToken: 'auth_token',
        merchantId: 'merchant_id'
      });
    };

    expect(fn).to.throw(Error, 'Missing configuration options');
  });

  it('should revert to default options for not supplied fields', () => {
    const iSignThis = new ISignThis({
      merchantId: 'merchant_id',
      apiClient: 'account.isignthis.com',
      authToken: 'auth_token',
      callbackAuthToken: 'callbackAuthToken'
    });

    expect(iSignThis.config.baseUrl).to.equal('https://gateway.isignthis.com');
    expect(iSignThis.config.merchantName).to.equal('node-isignthis-psp');
  });

  it('should allow overriding default fields', () => {
    const logMock = {debug (message) {}};
    const iSignThis = new ISignThis({
      merchantId: 'merchant_id',
      merchantName: 'The Merchant',
      apiClient: 'account.isignthis.com',
      authToken: 'auth_token',
      callbackAuthToken: 'callbackAuthToken',
      baseUrl: 'https://www.example.com',
      log: logMock
    });


    expect(iSignThis.config.baseUrl).to.equal('https://www.example.com');
    expect(iSignThis.config.merchantId).to.equal('merchant_id');
    expect(iSignThis.config.merchantName).to.equal('The Merchant');
    expect(iSignThis.config.apiClient).to.equal('account.isignthis.com');
    expect(iSignThis.config.authToken).to.equal('auth_token');
    expect(iSignThis.config.log).to.equal(logMock);
  });
});
