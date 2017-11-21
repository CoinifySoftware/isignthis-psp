const expect = require('chai').expect;

const ISignThis = require('../../index.js');

const acquirerId = 'clearhaus';
const merchantId = 'merchant_id';
const apiClient = 'api_client';
const authToken = 'auth_token';
const callbackAuthToken = 'callback_auth_token';

describe('isCallbackValid', () => {
  const iSignThis = new ISignThis({
    acquirerId, merchantId, apiClient,
    authToken, callbackAuthToken
  });

  it('should validate request when the right authorization token is provided', () => {
    const request = {headers: {authorization: `Bearer ${callbackAuthToken}`}};
    expect(iSignThis.isCallbackValid(request)).to.equal(true);
  });

  it('should not validate request when the wrong authorization token is provided', () => {
    const request = {headers: {authorization: 'Bearer wrong_token'}};
    expect(iSignThis.isCallbackValid(request)).to.equal(false);
  });

  it('should not validate request when no authorization token is provided', () => {
    const request = {headers: {}};
    expect(() => iSignThis.isCallbackValid(request)).to.throw('Authorization header missing');
  });
});
