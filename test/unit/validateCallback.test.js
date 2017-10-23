'use strict';

const
  chai = require('chai'),
  chaiSubset = require('chai-subset');

chai.use(chaiSubset);
const should = chai.should();

const ISignThis = require('../../index.js');

const clientCertificate = '1234';
const clientKey = '2345';
const acquirerId = 'clearhaus';
const merchantId = 'merchant_id';
const apiClient = 'api_client';
const authToken = 'auth_token';
const callbackAuthToken = 'callback_auth_token';

// Don't log anything during testing
const log = require('console-log-level')({level: 'fatal'});

describe('validateCallback', () => {
  let iSignThis;

  before(() => {
    iSignThis = new ISignThis({
      clientCertificate,
      clientKey,
      acquirerId,
      merchantId,
      apiClient,
      authToken,
      callbackAuthToken,
      log
    });
  });

  it('should validate request when the right authorization token is provided', (done) => {
    const request = {
      headers: {
        host: 'localhost:8221',
        authorization: `Bearer ${callbackAuthToken}`,
        'content-type': 'application/json',
        'content-length': '9',
        connection: 'close'
      }
    };

    iSignThis.validateCallback(request, (err, result) => {
      if (err) {
        return done(err);
      }

      const expectedResult = {
        success: true,
        message: 'Callback is valid'
      };

      result.should.deep.equal(expectedResult);

      done();
    });
  });

  it('should not validate request when the wrong authorization token is provided', (done) => {
    const request = {
      headers: {
        host: 'localhost:8221',
        authorization: 'Bearer wrongtoken',
        'content-type': 'application/json',
        'content-length': '9',
        connection: 'close'
      }
    };

    iSignThis.validateCallback(request, (err, result) => {
      if (err) {
        return done(err);
      }

      const expectedResult = {
        success: false,
        message: 'Callback is invalid'
      };

      result.should.deep.equal(expectedResult);

      done();
    });
  });

  it('should not validate request when no authorization token is provided', (done) => {
    const request = {
      headers: {
        host: 'localhost:8221',
        'content-type': 'application/json',
        'content-length': '9',
        connection: 'close'
      }
    };

    iSignThis.validateCallback(request, (err) => {
      err.should.be.an('error');
      err.message.should.equal('Authorization header missing');

      done();
    });
  });
});
