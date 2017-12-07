const chai = require('chai'),
  sinon = require('sinon'),
  chaiSubset = require('chai-subset');

chai.use(chaiSubset);
const expect = chai.expect;

const ISignThis = require('../../index.js');

describe('_constructPaymentRequestBody', () => {

  const iSignThis = new ISignThis({
    merchantId: 'merchantId',
    apiClient: 'apiClient',
    authToken: 'authToken',
    callbackAuthToken: 'callbackAuthToken',
    acquirerId: 'clearhaus'
  });

  let createPaymentArgs;

  beforeEach(() => {
    createPaymentArgs = {
      workflow: 'CORE',
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
  });

  it('shpuld throw error if workflow is missing', () => {
    delete createPaymentArgs.workflow;
    expect(() => iSignThis._constructPaymentRequestBody(createPaymentArgs))
      .to.throw('Insufficient arguments to createPayment');
  });

  it('should throw error if client.ip is missing', () => {
    delete createPaymentArgs.client.ip;
    expect(() => iSignThis._constructPaymentRequestBody(createPaymentArgs))
      .to.throw('Insufficient arguments to createPayment');
  });

  it('should construct request body and call post with all params', () => {
    const requestBody = iSignThis._constructPaymentRequestBody(createPaymentArgs);
    expect(requestBody).to.containSubset({
      workflow: 'CORE',
      acquirer_id: 'clearhaus',
      merchant: {
        id: 'merchantId',
        name: 'node-isignthis-psp',
        return_url: 'www.return.com'
      },
      transaction: {
        id: 'tx-id',
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
  });

  it('should construct request body and call post with minimum required params', async () => {
    createPaymentArgs = {
      workflow: 'CORE',
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

    const requestBody = await iSignThis._constructPaymentRequestBody(createPaymentArgs);
    expect(requestBody).to.containSubset({
      acquirer_id: 'clearhaus',
      merchant: {
        id: 'merchantId',
        name: 'node-isignthis-psp',
        return_url: 'www.return.com'
      },
      transaction: {
        id: '',
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
});
