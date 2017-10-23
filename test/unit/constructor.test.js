'use strict';

const expect = require('chai').expect;

const ISignThis = require('../../index.js');

describe('Constructor', () => {
  it('should throw an error on missing client certificate and merchant name', (done) => {
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

    done();
  });

  it('should revert to default options for not supplied fields', (done) => {
    const obj = new ISignThis({
      merchantId: 'merchant_id',
      apiClient: 'account.isignthis.com',
      authToken: 'auth_token',
      callbackAuthToken: 'callbackAuthToken'
    });

    obj.config.baseUrl.should.equal('https://gateway.isignthis.com');
    obj.config.merchantName.should.equal('node-isignthis-psp');
    obj.log.should.have.ownProperty('trace')
      .and.ownProperty('debug')
      .and.ownProperty('info')
      .and.ownProperty('warn')
      .and.ownProperty('error')
      .and.ownProperty('fatal');

    done();
  });

  it('should allow overriding default fields', (done) => {
    const logMock = {debug (message) {}};
    const obj = new ISignThis({
      merchantId: 'merchant_id',
      merchantName: 'The Merchant',
      apiClient: 'account.isignthis.com',
      authToken: 'auth_token',
      callbackAuthToken: 'callbackAuthToken',
      baseUrl: 'https://www.example.com',
      log: logMock
    });

    obj.config.merchantId.should.equal('merchant_id');
    obj.config.merchantName.should.equal('The Merchant');
    obj.config.baseUrl.should.equal('https://www.example.com');
    obj.config.apiClient.should.equal('account.isignthis.com');
    obj.config.authToken.should.equal('auth_token');
    obj.log.should.equal(logMock);

    done();
  });
});
