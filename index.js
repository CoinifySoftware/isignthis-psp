'use strict';

const requestPromise = require('request-promise-native'),
  _ = require('lodash'),
  consoleLogLevel = require('console-log-level');

const Currency = require('./lib/currency');

/* Errors for use in constructError() */
const ERROR_INVALID_STATE = 'invalid_state';
const ERROR_PROVIDER = 'provider_error';
const ERROR_MODULE = 'internal_module_error';
const ERROR_REQUEST = 'request_error';

const STATE_PENDING = 'pending',
  STATE_REVIEWING = 'reviewing',
  STATE_REJECTED = 'rejected',
  STATE_COMPLETED = 'completed',
  STATE_COMPLETED_TEST = 'completed_test';

/**
 * Default options that are merged into the options from the constructor
 *
 * @type {object}
 */
const DEFAULT_OPTIONS = {
  baseUrl: 'https://gateway.isignthis.com',
  merchantName: 'node-isignthis-psp',
  transactionId: ''
};

const AUTHORIZATION_PATH = '/v1/authorization';
const PROCESS_RECURRING_PATH = '/v1/recurring/authorization';

class ISignThis {
  /**
   * Create an instance of ISignThis
   *
   * @param {object} options Configuration
   * @param {string} options.merchantId Merchant to identify as
   * @param {string} options.apiClient API client used for authorization
   * @param {string} options.authToken Auth token used for communication
   * @param {string} options.callbackAuthToken Auth token used for validating callbacks
   * @param {string} options.log (optional) Bunyan-compatible logger
   * @param {string} options.baseUrl (optional) Base URL (without trailing slash) to iSignThis to use instead of default
   * @param {string} options.acquirerId (optional) Default acquirer to use if none specified when creating a payment
   *
   * @constructor
   */
  constructor(options) {
    this.config = _.defaultsDeep(options, DEFAULT_OPTIONS);

    // Ensure required options provided
    if (!this.config.merchantId || !this.config.apiClient || !this.config.authToken || !this.config.callbackAuthToken) {
      throw new Error('Missing configuration options');
    }

    // Set default logger if none provided
    this.log = options.log || consoleLogLevel({});

    // Prepare default options for HTTP requests
    this.defaultRequestOptions = {
      headers: {
        'Content-Type': 'application/json',
        From: this.config.apiClient,
        Authorization: `Bearer ${this.config.authToken}`
      }
    };
  }

  /**
   * Process a recurring payment using a recurringId in the request
   *
   * @param {object} processArgs
   * @param {string} processArgs.recurringId ID used to process this recurring payment
   * @param {string} processArgs.returnUrl URL to redirect to after a successful payment.
   * @param {object} processArgs.client
   * @param {string} processArgs.client.ip IP of the end-user
   * @param {string} processArgs.client.name (optional) Name of the end-user
   * @param {string} processArgs.client.address (optional) Address of the end-user
   * @param {string} processArgs.client.dob (optional) Date of birth of the end-user YYYY-MM-DD.
   * @param {string} processArgs.client.country (optional) Country of the end-user
   * @param {string} processArgs.client.email (optional) Email of the end-user
   * @param {object} processArgs.account
   * @param {string} processArgs.account.id Unique identifier for this account (e.g. internal user ID or equivalent)
   * @param {string} processArgs.account.secret (optional) Secret used by iSignThis
   * @param {string} processArgs.account.name (optional) Full name of account owner
   * @param {object} processArgs.transaction
   * @param {object} processArgs.transaction.id (optional) ID of the internal payment
   * @param {object} processArgs.transaction.reference (optional) Another internal reference
   *
   * @returns {Promise<payment>} Resolves in a payment object
   */
  async processRecurringPayment(processArgs) {
    // Check for recurringId
    if (!processArgs.recurringId) {
      throw new RangeError('recurringId must be provided');
    }

    // Construct request body
    const requestBody = this._constructPaymentRequestBody(processArgs);

    // Add recurringId to request
    requestBody.transaction.recurring_id = processArgs.recurringId;

    // Call iSignThis endpoint
    const response = await this._post(PROCESS_RECURRING_PATH, requestBody);

    // Parse response and return payment object
    return this._convertPaymentObject(response);
  }

  /**
   * Creates a new payment with iSignThis.
   *
   * @param {object} createArgs Create arguments
   * @param {object} createArgs.amount Amount in sub-units
   * @param {object} createArgs.currency Currency of the amount
   * @param {string} createArgs.returnUrl URL to redirect to after a successful payment.
   * @param {object} createArgs.client
   * @param {string} createArgs.client.ip IP of the end-user
   * @param {string} createArgs.client.name (optional) Name of the end-user
   * @param {string} createArgs.client.address (optional) Address of the end-user
   * @param {string} createArgs.client.dob (optional) Date of birth of the end-user YYYY-MM-DD.
   * @param {string} createArgs.client.country (optional) Country of the end-user
   * @param {string} createArgs.client.email (optional) Email of the end-user
   * @param {object} createArgs.account
   * @param {string} createArgs.account.id Unique identifier for this account (e.g. internal user ID or equivalent)
   * @param {string} createArgs.account.secret (optional) Secret used by iSignThis
   * @param {string} createArgs.account.name (optional) Full name of account owner
   * @param {object} createArgs.transaction
   * @param {object} createArgs.transaction.id (optional) ID of the internal payment
   * @param {object} createArgs.transaction.reference  (optional) Another internal reference
   *
   * @returns {Promise<payment>} Resolves in a payment object
   */
  async createPayment(createArgs) {
    // Check for required arguments (options)
    if (!createArgs.amount || !createArgs.currency) {
      throw new RangeError('Amount and currency should be provided');
    }

    // Construct request body
    const requestBody = this._constructPaymentRequestBody(createArgs);

    // Convert amount to main unit. Assume two decimals for all currencies
    const amountMainUnit = Currency.fromSmallestSubunit(createArgs.amount, createArgs.currency).toFixed(2);

    // Add amount and currency to request body
    requestBody.transaction.amount = amountMainUnit;
    requestBody.transaction.currency = createArgs.currency;

    // If initRecurring param is set, add it to the request
    if (createArgs.initRecurring) {
      requestBody.transaction.init_recurring = createArgs.initRecurring;
    }

    // Perform request
    const response = await this._post(AUTHORIZATION_PATH, requestBody);

    // Parse response and return payment object
    return this._convertPaymentObject(response);
  }

  /**
   * Retrieves information about a specific payment
   *
   * @param {int|object} paymentId Payment object or ID of payment
   * @returns {Promise<payment>} Resolves in a payment object
   */
  async getPayment(paymentId) {
    // Allow for passing full payment object instead of paymentId
    if (typeof paymentId === 'object') {
      paymentId = _.get(paymentId, 'raw.id');
    }

    // Construct path to update this specific payment
    const path = `${AUTHORIZATION_PATH}/${paymentId}`;

    // Perform request
    const response = await this._get(path);

    // Parse response and return payment object
    return this._convertPaymentObject(response);
  }

  /**
   * Cancels a specific payment
   *
   * @param {string} paymentId Payment ID
   * @returns {object} Raw response
   */
  async cancelPayment(paymentId) {
    if (!paymentId) {
      throw constructError('Payment Id not provided', ERROR_MODULE, null);
    }

    const requestPath = `/v1/transaction/${paymentId}/cancel`;

    try {
      const response = await this._post(requestPath, {});
      return response;
    } catch(err) {
      if (err.statusCode === 400) {
        const transactionCompleteError = _.find(err.error.details, _.matchesProperty('id', 'transaction-complete'));

        // Payment could not be cancelled. Return 'invalid_state' error
        if (transactionCompleteError) {
          throw constructError(transactionCompleteError.message, ERROR_INVALID_STATE, err);
        }
      }

      // If unknown error - just throw
      throw err;
    }
  }

  /**
   * Validate request if correct autorization header is set
   *
   * @param {object} request Raw request object
   * @returns {boolean}
   */
  isCallbackValid(request) {
    // Check if token is provided
    if (!request.headers.authorization) {
      throw constructError('Authorization header missing', ERROR_REQUEST, null);
    }

    // Get token
    const token = request.headers.authorization.split(' ')[1];

    // Return if token is valid
    return token === this.config.callbackAuthToken;
  }

  /**
   * Parses a requestBody into a payment object and returns the result.
   *
   * @param {object} requestBody Body of the callback request
   * @returns {object} Payment object
   */
  parsePayment(requestBody) {
    return this._convertPaymentObject(requestBody);
  }

  /**
   * Perform a GET request
   *
   * @param {string} path Path with leading slash
   * @returns {Promise<object>} Resolves in response of the request
   * @private
   */
  _get(path) {
    // Prepare options for the request, extended from default options
    const options = _.defaultsDeep({
      json: true,
      url: this.config.baseUrl + path
    }, this.defaultRequestOptions);

    // Briefly log that we are about to perform a GET request
    this.log.info({
      url: options.url
    }, 'Performing GET request');

    // Perform the GET request
    return requestPromise.get(options);
  }

  /**
   * Perform a POST request
   *
   * @param {string} path Path with leading slash
   * @param {object} requestBody Object to send as JSON data
   * @returns {Promise<object>} Resolves in a response object
   * @private
   */
  _post(path, requestBody) {
    // Prepare options for the request, extended from default options
    const options = _.defaultsDeep({
      body: requestBody,
      json: true,
      url: this.config.baseUrl + path
    }, this.defaultRequestOptions);

    // remove secrets from the body for logging
    const bodyToLog = _.omit(requestBody, ['account.secret', 'downstream_auth_value']);

    // Briefly log that we are about to perform a POST request
    this.log.info({
      url: options.url,
      request: {
        body: JSON.stringify(bodyToLog)
      }
    }, 'Performing POST request');

    return requestPromise.post(options);
  }

  /**
   * Construct request body for IST create payment and process recurring endpoints
   *
   * @param  {object} args Arguments provided
   * @return {object}      Returns request body
   */
  _constructPaymentRequestBody(args) {
    // Check for required arguments
    if (!args.returnUrl || !args.client || !args.client.ip ||
      !args.account || !args.account.id || !args.workflow) {
      throw new RangeError('Insufficient arguments to createPayment');
    }

    // Set acquirerId
    const acquirerId = args.acquirerId || this.config.acquirerId;
    // Extract transaction ID and reference strings
    const transactionId = args.transaction && args.transaction.id || this.config.transactionId;
    // Default value is a string with a space in it (iSignThis won't accept empty string here, so we add a space)
    const transactionReference = args.transaction && args.transaction.reference || ' ';
    // Construct account and client object
    const account = ISignThis._createPaymentSanitizeAccountObject(args.account);
    const client = ISignThis._createPaymentSanitizeClientObject(args.client);

    return {
      client, account,
      workflow: args.workflow,
      acquirer_id: acquirerId,
      merchant: {
        id: args.merchantId || this.config.merchantId, // our merchant at IST
        name: this.config.merchantName, // our internal user name
        return_url: args.returnUrl // our return URL for user to return to
      },
      transaction: {
        id: transactionId, // Internal reference for the transaction
        datetime: new Date().toISOString(), // "2015-12-16T09:22:13.48+01:00",
        reference: transactionReference
      },
      downstream_auth_type: 'bearer',
      downstream_auth_value: this.config.callbackAuthToken,
      requested_workflow: 'SCA'
    };
  }

  /**
   * Converts a state string from an iSignThis payment object to one of the allowed states of a payment:
   *   pending, rejected, declined, failed, expired, completed
   *
   * @param {string} state
   * @param {string} compoundState
   * @returns {string|null}
   * @private
   */
  static _convertPaymentState(state, compoundState) {
    state = state.toLowerCase();
    compoundState = compoundState && compoundState.toLowerCase();

    let paymentState;

    /*
     * First decide from original state
     */
    switch (state) {
      case 'pending':
      case 'rejected':
      case 'failed':
      case 'expired':
      case 'cancelled':
        paymentState = state;
        break;
      case 'manual_review':
        paymentState = STATE_REVIEWING;
        break;
      case 'success':
        paymentState = STATE_COMPLETED;
        break;
      case 'card_expired':
      case 'declined':
        paymentState = STATE_REJECTED;
        break;
      case 'processing_document':
        /*
         * PROCESSING_DOCUMENT is a pending state
         */
        paymentState = STATE_PENDING;
        break;
      case 'preflight':
        /*
         * From Mike Roveto, Chief Engineer with iSX, Jan 9th 2017:
         *
         * PREFLIGHT is the first state in our platform when receiving a transaction from our API gateway but has yet to be processed by our backend.
         * Our backend platform turns the PREFLIGHT state to PENDING once the transaction registration has been processed and registered asynchronously.
         * (...)
         * You can treat the state PREFLIGHT as compound state: PENDING.VALIDATED_TRANSACTION and nothing significant has happened to the transaction.
         */
        paymentState = STATE_PENDING;
        break;
      default:
        return null;
    }

    /*
     * compoundState can overwrite the state
     */
    switch (compoundState) {
      case 'pending.manual_review':
      case 'pending.manual_hold':
      case 'pending.risk_review':
        paymentState = STATE_REVIEWING;
        break;
      default:
        break;
    }

    return paymentState;
  }

  /**
   * Converts a payment object as returned from the iSignThis API into a payment object
   * that is expected as the result of createPayment and getPayment functions.
   *
   * A response object for a newly created payment looks like this:
   *
   * {
   *   "id": "0d2c106e-94aa-45af-ad01-adfedb26a5e3",
   *   "uid": "0d2c106e-94aa-45af-ad01-adfedb26a5e3",
   *   "context_uid": "4f3487be-a61c-4109-b86a-e4c98b566e71",
   *   "secret": "5f62e2e0-aa10-4349-bdad-c9d13fac3adb",
   *   "mode": "capture",
   *   "original_message": {
   *     "merchant_id": "coinify_sca",
   *     "transaction_id": "28",
   *     "reference": " "
   *   },
   *   card_reference: {
   *     card_brand: "MASTERCARD",
   *     card_token: "cardToken",
   *     masked_pan: "111111...1111",
   *     expiry_date: "0721"
   *   },
   *   "expires_at": "2016-03-21T14:10:33.596Z",
   *   "state": "PENDING",
   *   "compound_state": "PENDING.VALIDATED_TRANSACTION",
   *   "redirect_url": "https://verify.isignthis.com/landing/0d2c106e-94aa-45af-ad01-adfedb26a5e3"
   * }
   * @param {object} obj
   * @returns {object}
   * @private
   */
  _convertPaymentObject(obj) {
    const convertTransaction = function (tx) {
      return {
        id: tx.bank_id,
        amount: Currency.toSmallestSubunit(tx.amount, tx.currency),
        currency: tx.currency
      };
    };

    // Set state from obj.state parameter
    let state = ISignThis._convertPaymentState(obj.state, obj.compound_state);
    if (!state) {
      this.log.error({state, rawResponse: JSON.stringify(obj)}, 'Unknown payment state');
    }

    /*
     * If state is completed we also check if it was paid using a test card
     * - if test_transaction = true
     */
    if (state === STATE_COMPLETED && obj.test_transaction === true) {
      state = STATE_COMPLETED_TEST;
    }

    /*
     * Only add identity block if KYC has been approved
     * We check if workflow_state.kyc is 'ACCEPTED'
     */
    let kycReviewIncluded = false;
    if (obj.workflow_state && obj.workflow_state.kyc !== 'NA') {
      kycReviewIncluded = true;
    }

    const card = {};

    if (obj.card_reference) {
      card.token = obj.card_reference.card_token;
      card.brand = obj.card_reference.card_brand;
      card.expiryDate = obj.card_reference.expiry_date;

      const cardNumber = obj.card_reference.masked_pan;
      card.bin = cardNumber.substring(0, 6);
      card.last4 = cardNumber.substring(cardNumber.length - 4);

      // Add recurringId if present
      if (obj.card_reference.recurring_id) {
        card.recurringId = obj.card_reference.recurring_id;
      }
    }

    return {
      id: obj.id,
      acquirerId: obj.transactions && obj.transactions[0] && obj.transactions[0].acquirer_id,
      state,
      event: obj.event,
      expiryTime: obj.expires_at,
      redirectUrl: obj.redirect_url,
      transactions: obj.transactions ? obj.transactions.map(convertTransaction) : undefined,
      kycReviewIncluded,
      card,
      raw: obj
    };
  }

  /**
   * Sanitize and return an `account` object as received inside the options to createPayment
   *
   * @param {object} args Account args
   * @returns {object} Sanitized object, ready to POST to iSignThis
   * @private
   */
  static _createPaymentSanitizeAccountObject(args) {
    const account = _.pick(args, ['id', 'secret', 'name']);

    /*
     * Sanitize account object:
     * * Rename 'id' key to 'identifier'
     * * Add identifier_type: 'ID' field
     * * Rename 'name' key to 'full_name' if exists
     */
    account.identifier = account.id;
    delete account.id;
    account.identifier_type = 'ID';
    if (account.name) {
      account.full_name = account.name;
      delete account.name;
    } else {
      // As discussed orally with iSignThis, we can currently get away with sending two spaces
      // if we don't have the full name of the account
      account.full_name = '  ';
    }

    return account;
  }

  /**
   * Sanitize and return an `client` object as received inside the options to createPayment
   *
   * @param {object} args
   * @returns {object} Sanitized object, ready to POST to iSignThis
   * @private
   */
  static _createPaymentSanitizeClientObject(args) {
    const client = _.pick(args, ['ip', 'name', 'dob', 'country', 'email', 'address']);

    // Transform name to empty string if null
    client.name = client.name === null ? '' : client.name;
    // Transform address to empty string if null
    client.address = client.address === null ? '' : client.address;

    // Set citizen_country and birth_country to the value of country. Remove country
    if (client.country) {
      client.citizen_country = client.country;
      client.birth_country = client.country;
      delete client.country;
    }

    return client;
  }
}



/**
 * Constructs and returns an Node Error object, attaches a message and a pre-declared error code to it,
 * and the original error data, if provided.
 * @param {string}        message     Human readable error message
 * @param {string}        errorCode   Machine readable error message code
 * @param {object|string} errorCause  The raw/original error data (message or an object of messages) that the system
 *                                    responded with and provides detailed information about the cause of the error
 * @returns {Error}
 */
function constructError(message, errorCode, errorCause) {
  const error = new Error(message);
  error.code = errorCode;
  if (errorCause) {
    error.cause = errorCause;
  }
  return error;
}

module.exports = ISignThis;
