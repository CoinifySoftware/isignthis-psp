const expect = require('chai').expect,
  _ = require('lodash');

const ISignThis = require('../../index.js');

const acquirerId = 'clearhaus';
const merchantId = 'merchant_id';

describe('_convertPaymentObject', () => {
  const iSignThis = new ISignThis({
    merchantId, acquirerId,
    apiClient: 'apiClient',
    authToken: 'authToken',
    callbackAuthToken: 'callbackAuthToken'
  });

  let responseObject;
  beforeEach(() => {
    responseObject = {
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

  afterEach(() => {

  });

  it('should parse payment and return payment object ', () => {
    const payment = iSignThis._convertPaymentObject(responseObject);
    expect(payment).to.deep.equal({
      id: 'c97f0bfc-c1ac-46c3-96d8-6605a63d380d',
      acquirerId: 'clearhaus',
      state: 'pending',
      expiryTime: '2016-03-06T13:36:59.196Z',
      redirectUrl: undefined,
      transactions: [
        {
          id: '2774d451-5499-41a6-a37e-6a90f2b8673c',
          amount: 70,
          currency: 'DKK'
        },
        {
          id: '73f63c0b-7c59-416f-89e5-17dcc38b64ac',
          amount: 30,
          currency: 'DKK'
        }
      ],
      kycReviewIncluded: false,
      card: {},
      raw: responseObject
    });
  });

  it('should return card details when provided', () => {
    responseObject = _.defaultsDeep({
      card_reference: {
        masked_pan: '550000...0004',
        card_token: 'f7fb955_15fc0a831d7__7fa8',
        card_brand: 'MASTERCARD',
        expiry_date: '1217',
        recurring_id: 'f7fb955_15fc0a831d7__7fa7'
      }
    }, responseObject);

    const payment = iSignThis._convertPaymentObject(responseObject);

    expect(payment.card).to.deep.equal({
      token: 'f7fb955_15fc0a831d7__7fa8',
      brand: 'MASTERCARD',
      expiryDate: '1217',
      bin: '550000',
      last4: '0004',
      recurringId: 'f7fb955_15fc0a831d7__7fa7'
    });
  });

  it('should return kycReviewIncluded true if workflow_state is not NA', () => {
    responseObject = _.defaultsDeep({
      workflow_state: {
        sca: 'ACCEPTED', // Possible values: NA / PENDING / ACCEPTED / FAILED / EXPIRED
        charge: 'ACCEPTED',
        kyc: 'ACCEPTED',
        capture: 'ACCEPTED',
        piv: 'ACCEPTED'
      }
    }, responseObject);

    const payment = iSignThis._convertPaymentObject(responseObject);

    expect(payment.kycReviewIncluded).to.equal(true);
  });

  it('should return kycReviewIncluded false if workflow_state is NA', () => {
    responseObject = _.defaultsDeep({
      workflow_state: {
        sca: 'ACCEPTED', // Possible values: NA / PENDING / ACCEPTED / FAILED / EXPIRED
        charge: 'ACCEPTED',
        kyc: 'NA',
        capture: 'ACCEPTED',
        piv: 'ACCEPTED'
      }
    }, responseObject);

    const payment = iSignThis._convertPaymentObject(responseObject);

    expect(payment.kycReviewIncluded).to.equal(false);
  });

  it('should parse payment with state completed', () => {
    responseObject.state = 'success';

    const payment = iSignThis._convertPaymentObject(responseObject);

    expect(payment.state).to.equal('completed');
  });

  it('should parse test payment with state completed', () => {
    responseObject.state = 'success';
    responseObject.test_transaction = true;

    const payment = iSignThis._convertPaymentObject(responseObject);

    expect(payment.state).to.equal('completed_test');
  });

  it('should parse test payment with state expired', () => {
    responseObject.state = 'expired';
    responseObject.test_transaction = true;

    const payment = iSignThis._convertPaymentObject(responseObject);

    expect(payment.state).to.equal('expired');
  });

  it('should parse payment with state manual_review', () => {
    responseObject.state = 'manual_review';

    const payment = iSignThis._convertPaymentObject(responseObject);

    expect(payment.state).to.equal('reviewing');
  });

  it('should parse payment with state cancelled', () => {
    responseObject.state = 'cancelled';

    const payment = iSignThis._convertPaymentObject(responseObject);

    expect(payment.state).to.equal('cancelled');
  });

  it('should parse payment with state declined', () => {
    responseObject.state = 'declined';

    const payment = iSignThis._convertPaymentObject(responseObject);

    expect(payment.state).to.equal('rejected');
  });

  it('should parse payment with state card_expired', () => {
    responseObject.state = 'CARD_EXPIRED';

    const payment = iSignThis._convertPaymentObject(responseObject);

    expect(payment.state).to.equal('rejected');
  });

  it('should parse payment with state preflight', () => {
    responseObject.state = 'PREFLIGHT';

    const payment = iSignThis._convertPaymentObject(responseObject);

    expect(payment.state).to.equal('pending');
  });

  it('should parse payment with state processing_document', () => {
    responseObject.state = 'PROCESSING_DOCUMENT';

    const payment = iSignThis._convertPaymentObject(responseObject);

    expect(payment.state).to.equal('pending');
  });

  it('should overwrite state when compound state is PENDING.RISK_REVIEW', () => {
    responseObject.compound_state = 'PENDING.RISK_REVIEW';

    const payment = iSignThis._convertPaymentObject(responseObject);

    expect(payment.state).to.equal('reviewing');
  });

  it('should overwrite state when compound state is PENDING.MANUAL_REVIEW', () => {
    responseObject.compound_state = 'PENDING.RISK_REVIEW';

    const payment = iSignThis._convertPaymentObject(responseObject);

    expect(payment.state).to.equal('reviewing');
  });

  it('should overwrite state when compound state is PENDING.MANUAL_HOLD', () => {
    responseObject.compound_state = 'PENDING.MANUAL_HOLD';

    const payment = iSignThis._convertPaymentObject(responseObject);

    expect(payment.state).to.equal('reviewing');
  });
});
