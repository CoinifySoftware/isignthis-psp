'use strict';

const _ = require('lodash'),
  chai = require('chai'),
  expect = require('chai').expect,
  chaiSubset = require('chai-subset');

chai.use(chaiSubset);

const ISignThis = require('../../index.js');

const clientCertificate = '1234',
  clientKey = '2345',
  acquirerId = 'clearhaus',
  merchantId = 'merchant_id',
  apiClient = 'api_client',
  callbackAuthToken = 'callbck_auth_token',
  authToken = 'auth_token';

describe('parsePayment', () => {
  let iSignThis;
  let requestBody;

  before(() => {
    iSignThis = new ISignThis({
      clientCertificate,
      clientKey,
      acquirerId,
      merchantId,
      apiClient,
      callbackAuthToken,
      authToken
    });
  });

  beforeEach(() => {
    requestBody = {
      id: 'c97f0bfc-c1ac-46c3-96d8-6605a63d380d',
      uid: 'c97f0bfc-c1ac-46c3-96d8-6605a63d380d',
      secret: 'f8fd310d-3755-4e63-ae98-ab3629ef245d',
      mode: 'registration',
      original_message: {
        merchant_id: merchantId,
        transaction_id: 'Test',
        reference: 'Coinify Card Verification'
      },
      expires_at: '2016-03-06T13:36:59.196Z',
      transactions: [
        {
          acquirer_id: acquirerId,
          bank_id: '2774d451-5499-41a6-a37e-6a90f2b8673c',
          response_code: '20000',
          success: true,
          amount: '0.70',
          currency: 'DKK',
          message_class: 'authorization-and-capture',
          status_code: '20000'
        },
        {
          acquirer_id: acquirerId,
          bank_id: '73f63c0b-7c59-416f-89e5-17dcc38b64ac',
          response_code: '20000',
          success: true,
          amount: '0.30',
          currency: 'DKK',
          message_class: 'authorization-and-capture',
          status_code: '20000'
        }
      ],
      state: 'PENDING',
      compound_state: 'PENDING.AWAIT_SECRET'
    };
  });

  it('should parse payment and return payment object ', () => {
    const payment = iSignThis.parsePayment(requestBody);

    /* Briefly check payment object. See test for _convertPaymentObject() for full coverage */
    expect(payment.id).to.equal(requestBody.id);
    expect(payment.kycReviewIncluded).to.equal(false);
  });

  it('should return kycReviewIncluded true if workflow_state is not NA', () => {
    requestBody = _.defaultsDeep({
      workflow_state: {
        sca: 'ACCEPTED', // Possible values: NA / PENDING / ACCEPTED / FAILED / EXPIRED
        charge: 'ACCEPTED',
        kyc: 'ACCEPTED',
        capture: 'ACCEPTED',
        piv: 'ACCEPTED'
      }
    }, requestBody);

    const payment = iSignThis.parsePayment(requestBody);

    expect(payment.kycReviewIncluded).to.equal(true);
  });

  it('should return kycReviewIncluded false if workflow_state is NA', () => {
    requestBody = _.defaultsDeep({
      workflow_state: {
        sca: 'ACCEPTED', // Possible values: NA / PENDING / ACCEPTED / FAILED / EXPIRED
        charge: 'ACCEPTED',
        kyc: 'NA',
        capture: 'ACCEPTED',
        piv: 'ACCEPTED'
      }
    }, requestBody);

    const payment = iSignThis.parsePayment(requestBody);

    expect(payment.kycReviewIncluded).to.equal(false);
  });

  it('should parse payment with state completed', () => {
    requestBody.state = 'success';

    const payment = iSignThis.parsePayment(requestBody);

    expect(payment.state).to.equal('completed');
  });

  it('should parse test payment with state completed', () => {
    requestBody.state = 'success';
    requestBody.test_transaction = true;

    const payment = iSignThis.parsePayment(requestBody);

    expect(payment.state).to.equal('completed_test');
  });

  it('should parse test payment with state expired', () => {
    requestBody.state = 'expired';
    requestBody.test_transaction = true;

    const payment = iSignThis.parsePayment(requestBody);

    expect(payment.state).to.equal('expired');
  });

  it('should parse payment with state manual_review', () => {
    requestBody.state = 'manual_review';

    const payment = iSignThis.parsePayment(requestBody);

    expect(payment.state).to.equal('reviewing');
  });

  it('should parse payment with state cancelled', () => {
    requestBody.state = 'cancelled';

    const payment = iSignThis.parsePayment(requestBody);

    expect(payment.state).to.equal('cancelled');
  });

  it('should parse payment with state declined', () => {
    requestBody.state = 'declined';

    const payment = iSignThis.parsePayment(requestBody);

    expect(payment.state).to.equal('rejected');
  });

  it('should parse payment with state preflight', () => {
    requestBody.state = 'PREFLIGHT';

    const payment = iSignThis.parsePayment(requestBody);

    expect(payment.state).to.equal('pending');
  });

  it('should parse payment with state processing_document', () => {
    requestBody.state = 'PROCESSING_DOCUMENT';

    const payment = iSignThis.parsePayment(requestBody);

    expect(payment.state).to.equal('pending');
  });

  it('should overwrite state when compound state is PENDING.RISK_REVIEW', () => {
    requestBody.compound_state = 'PENDING.RISK_REVIEW';

    const payment = iSignThis.parsePayment(requestBody);

    expect(payment.state).to.equal('reviewing');
  });

  it('should overwrite state when compound state is PENDING.MANUAL_REVIEW', () => {
    requestBody.compound_state = 'PENDING.RISK_REVIEW';

    const payment = iSignThis.parsePayment(requestBody);

    expect(payment.state).to.equal('reviewing');
  });

  it('should overwrite state when compound state is PENDING.MANUAL_HOLD', () => {
    requestBody.compound_state = 'PENDING.MANUAL_HOLD';

    const payment = iSignThis.parsePayment(requestBody);

    expect(payment.state).to.equal('reviewing');
  });
});
