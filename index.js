'use strict';

const request = require('request'),
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

/**
 * Create an instance of ISignThis
 *
 * @param {object} options The following fields are required:<ul>
 *                           <li><code>merchantId</code> - Merchant to identify as</li>
 *                           <li><code>apiClient</code> - API client used for authorization</li>
 *                           <li><code>authToken</coden> - Authorization token used for communication</li
 *                         </ul>
 *                         The following fields are optional:<ul>
 *                           <li><code>log</code> - Bunyan-compatible logger</li>
 *                           <li><code>baseUrl</code> - Base URL (without trailing slash) to iSignThis to use instead of default</li>
 *                           <li><code>acquirerId</code> - Default acquirer to use if none specified when creating a payment</li>
 *                         </ul>
 * @constructor
 */
function ISignThis(options) {
  this.config = _.defaultsDeep(options, DEFAULT_OPTIONS);

  /*
   * Ensure required options provided
   */
  if (!this.config.merchantId || !this.config.apiClient || !this.config.authToken || !this.config.callbackAuthToken) {
    throw new Error('Missing configuration options');
  }

  /*
   * Set default logger if none provided
   */
  this.log = options.log || consoleLogLevel({});

  /*
   * Prepare default options for HTTP requests
   */
  this.defaultRequestOptions = {
    headers: {
      'Content-Type': 'application/json',
      From: this.config.apiClient,
      Authorization: `Bearer ${this.config.authToken}`
    }
  };
}

/**
 * Create a callback function for a HTTP request that parses and returns JSON data to the supplied callback.
 *
 * @param {function} callback Callback(err, obj)
 * @returns {Function}
 * @private
 */

ISignThis.prototype._createPaymentRequestCallback = function (callback) {
  const _this = this;

  return (err, httpResponse, body) => {
    if (err) {
      return callback(err);
    }
    /*
     * Parse the body to an object if necessary.
     * On POST requests, body is already a JS object,
     * while on GET requests, it is a string with a JSON representation of an object
     */
    let responseObject = body;
    if (typeof responseObject !== 'object') {
      try {
        responseObject = JSON.parse(responseObject);
      } catch (err) {
        _this.log.error({
          httpResponse,
          err
        }, 'Couldn\'t parse response body');
        return callback(constructError('Couldn\'t parse response body', ERROR_PROVIDER, err));
      }
    }

    /* Check for body */
    if (!responseObject) {
      _this.log.error({
        httpResponse
      }, 'Empty response body');
      return callback(constructError('Empty response body', ERROR_PROVIDER, null));
    }

    /* If response object contains an error - return error */
    if (responseObject.error) {
      return callback(constructError('Error in response object', ERROR_PROVIDER, responseObject));
    }

    const paymentObject = this._convertPaymentObject(responseObject);

    return callback(null, paymentObject);
  };
};

/**
 * Perform a GET request to a specific path
 *
 * @param {string} path Path with leading slash
 * @param {function} callback Callback(err, object)
 * @private
 */
ISignThis.prototype._get = function (path, callback) {
  /* Prepare options for the request, extended from default options */
  const options = _.defaultsDeep({
    url: this.config.baseUrl + path
  }, this.defaultRequestOptions);

  /* Briefly log that we are about to perform a GET request */
  this.log.info({
    url: options.url
  }, 'Performing GET request');

  /* Perform the GET request */
  // request.get(options, this._createPaymentRequestCallback(options, callback));
  request.get(options, (err, httpResponse, body) => {
    /* Check for error */
    if (err) {
      this.log.error({
        err,
        requestData: options.json,
        requestUrl: options.url,
        responseBody: body
      }, 'Request error');
      return callback(constructError('Provider communication error', ERROR_PROVIDER, err));
    }

    /* Check for non-2xx response */
    if (httpResponse.statusCode < 200 || httpResponse.statusCode > 299) {
      const error = constructError(`Expected HTTP status 2xx. Received ${httpResponse.statusCode}`, ERROR_PROVIDER, null);
      error.statusCode = httpResponse.statusCode;
      error.requestData = options.json;
      error.requestUrl = options.url;
      error.responseBody = body;
      return callback(error);
    }

    return callback(null, httpResponse, body);
  });
};

/**
 *
 * @param {string} path Path with leading slash
 * @param {object} data Object to send as JSON data
 * @param {function} callback Callback(err, object)
 * @private
 */
ISignThis.prototype._post = function (path, data, callback) {
  /* Prepare options for the request, extended from default options */
  const options = _.defaultsDeep({
    url: this.config.baseUrl + path,
    json: data
  }, this.defaultRequestOptions);

  /* Briefly log that we are about to perform a POST request */
  this.log.info({
    url: options.url,
    data
  }, 'Performing POST request');

  request.post(options, (err, httpResponse, body) => {
    /* Check for error */
    if (err) {
      this.log.error({
        err,
        requestData: options.json,
        requestUrl: options.url,
        responseBody: JSON.stringify(body || '')
      }, 'Request error');
      return callback(constructError('Provider communication error', ERROR_PROVIDER, err));
    }

    /* Check for non-2xx response */
    if (httpResponse.statusCode < 200 || httpResponse.statusCode > 299) {
      const error = constructError(`Expected HTTP status 2xx. Received ${httpResponse.statusCode}`, ERROR_PROVIDER, null);
      error.statusCode = httpResponse.statusCode;
      error.requestData = options.json;
      error.requestUrl = options.url;
      error.responseBody = JSON.stringify(body || '');
      return callback(error);
    }

    return callback(null, httpResponse, body);
  });
};

/**
 * Converts a state string from an iSignThis payment object to one of the allowed states of a payment:
 *   pending, rejected, declined, failed, expired, completed
 *
 * @param {string} state
 * @param {string} compoundState
 * @returns {string|null}
 * @private
 */
ISignThis.prototype._convertPaymentState = function (state, compoundState) {
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
      this.log.error({state}, 'Unknown payment state');
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
};

/**
 * Converts a payment object as returned from the iSignThis API into a payment object
 * that is expected as the result of createPayment and getPayment functions.
 *
 * @param {object} obj
 * @returns {object}
 * @private
 */
ISignThis.prototype._convertPaymentObject = function (obj) {
  /*
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
   */

  const convertTransaction = function (tx) {
    return {
      id: tx.bank_id,
      amount: Currency.toSmallestSubunit(tx.amount, tx.currency),
      currency: tx.currency
    };
  };

  /*
   * Set state from obj.state parameter
   */
  let state = this._convertPaymentState(obj.state, obj.compound_state);

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
  }

  return {
    id: obj.id,
    acquirerId: obj.transactions && obj.transactions[0] && obj.transactions[0].acquirer_id,
    state,
    expiryTime: obj.expires_at,
    redirectUrl: obj.redirect_url,
    transactions: obj.transactions ? obj.transactions.map(convertTransaction) : undefined,
    kycReviewIncluded,
    card,
    raw: obj
  };
};

/**
 * Sanitize and return an `account` object as received inside the options to createPayment
 *
 * @param {object} account
 * @returns {object} Sanitized object, ready to POST to iSignThis
 * @private
 */
ISignThis.prototype._createPaymentSanitizeAccountObject = function (account) {
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
};

/**
 * Sanitize and return an `client` object as received inside the options to createPayment
 *
 * @param {object} client
 * @returns {object} Sanitized object, ready to POST to iSignThis
 * @private
 */
ISignThis.prototype._createPaymentSanitizeClientObject = function (client) {
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
};

/**
 * Creates a new payment with iSignThis.
 *
 * @param {object} options
 * @param {function} callback Callback(err, payment)
 */
ISignThis.prototype.createPayment = function iSignThisCreatePayment(options, callback) {
  /* Check for required arguments (options) */
  if (!options.returnUrl || !options.amount || !options.currency ||
    !options.client || !options.client.ip ||
    !options.account || !options.account.id) {
    throw new RangeError('Insufficient arguments to createPayment');
  }

  /* Set options from default values */
  if (!options.acquirerId) {
    if (!this.config.acquirerId) {
      throw new RangeError('No acquirerId provided');
    }
    options.acquirerId = this.config.acquirerId;
  }

  /* Extract transaction ID and reference strings */
  const transactionId = options.transaction && options.transaction.id || this.config.transactionId;
  // Default value is a string with a space in it (iSignThis won't accept empty string here, so we add a space)
  const transactionReference = options.transaction && options.transaction.reference || ' ';

  /* Only allow whitelisted keys in client and account objects to pass through to the request object */
  let client = _.pick(options.client, ['ip', 'name', 'dob', 'country', 'email', 'address']);
  let account = _.pick(options.account, ['id', 'secret', 'name']);

  account = this._createPaymentSanitizeAccountObject(account);
  client = this._createPaymentSanitizeClientObject(client);

  /* Convert amount to main unit. Assume two decimals for all currencies */
  const amountMainUnit = Currency.fromSmallestSubunit(options.amount, options.currency).toFixed(2);

  /* Construct POST request data */
  const data = {
    // "repeat": false,
    acquirer_id: options.acquirerId,
    merchant: {
      id: options.merchantId || this.config.merchantId, // our merchant at IST
      name: this.config.merchantName, // our internal user name
      return_url: options.returnUrl // our return URL for user to return to
    },
    transaction: {
      id: transactionId, // Internal reference for the transaction
      datetime: new Date().toISOString(), // "2015-12-16T09:22:13.48+01:00",
      amount: amountMainUnit,
      currency: options.currency,
      reference: transactionReference
    },
    client,
    account,
    downstream_auth_type: 'bearer',
    downstream_auth_value: this.config.callbackAuthToken,
    requested_workflow: 'SCA'
  };

  /* card object is optional, only pass it to IST if defined */
  if (options.card && options.card.token) {
    // documentation about the format IST expects the card token to be in is here
    // https://coinify.atlassian.net/browse/DEV-3464
    data.cardholder = {card_token: options.card.token};
  }

  /* Perform request */
  this._post(AUTHORIZATION_PATH, data, this._createPaymentRequestCallback(callback));
};

/**
 * Retrieves information about a specific payment
 *
 * @param {int|object} paymentId Payment object or ID of payment
 * @param {function} callback Callback(err, payment)
 * @returns {object}
 */
ISignThis.prototype.getPayment = function iSignThisGetPayment(paymentId, callback) {
  /* Allow for passing full payment object instead of paymentId */
  if (typeof paymentId === 'object') {
    paymentId = _.get(paymentId, 'raw.id');
  }

  /* Construct path to update this specific payment */
  const path = `${AUTHORIZATION_PATH}/${paymentId}`;

  /* Perform request */
  return this._get(path, this._createPaymentRequestCallback(callback));
};

/**
 * Cancels a specific payment
 *
 * @param {int} paymentId Payment ID
 * @param {function} callback Callback(err, payment)
 * @returns {undefined}
 */
ISignThis.prototype.cancelPayment = function iSignThisCancelPayment(paymentId, callback) {
  if (!paymentId) {
    return callback(constructError('Payment Id not provided', ERROR_MODULE, null));
  }

  const requestPath = `${AUTHORIZATION_PATH}/${paymentId}/cancel`;

  return this._post(requestPath, {}, (err, httpResponse, body) => {
    if (err) {
      /*
       * If error, check if it's because the payment cannot be cancelled. If so, return 'invalid_state' error code.
       *
       * Check for the following body:
       * {error:[{'transaction-complete':"Transaction is already final and can't be cancelled"}]}
       */
      if (err.statusCode === 400) {
        const bodyObject = JSON.parse(err.responseBody || '{}');
        const errorObject = _.isObject(bodyObject) && bodyObject.error ? bodyObject.error : [];
        // check if details are provided
        if (_.isObject(bodyObject) && bodyObject.details) {
          bodyObject.details.forEach((detail) => {
            errorObject.push({[detail.id]: detail.message});
          });
        }
        const transactionCompleteError = _.find(errorObject, value => value['transaction-complete']);

        if (transactionCompleteError) {
          /*
           * Payment could not be cancelled. Return 'invalid_state' error
           */
          const errorMessage = transactionCompleteError['transaction-complete'];
          const wrappedError = constructError(errorMessage, ERROR_INVALID_STATE, err);
          return callback(wrappedError);
        }
      }

      return callback(err);
    }

    return callback(null, httpResponse, body);
  });
};

/**
 * Validate by the request object and return callback with resultObject if the request
 *
 * If callback is validated we return 'success: true' and if callback is not validated we
 * return `success: false`. Both with a 'message' describing the result.
 *
 * Example of a resultObject:
 * {
 *   success: false,
 *   message: 'Bearer token is invalid'
 * }
 *
 * @param request
 * @param {function} callback Callback(err, resultObject)
 */
ISignThis.prototype.validateCallback = function iSignThisVerifyCallback(request, callback) {
  /* Check if token is provided */
  if (!request.headers.authorization) {
    return callback(constructError('Authorization header missing', ERROR_REQUEST, null));
  }

  /* Get token */
  const token = request.headers.authorization.split(' ')[1];

  /* Return if token is validated */
  if (token === this.config.callbackAuthToken) {
    return callback(null, {
      success: true,
      message: 'Callback is valid'
    });
  }

  /* Log request object and return invalid callback */
  this.log.warn({
    request
  }, 'Callback is invalid');

  return callback(null, {
    success: false,
    message: 'Callback is invalid'
  });
};

/**
 * Parses a requestBody into a payment object and returns the result.
 *
 * @param {object} requestBody Body of the callback request
 * @returns {object} Payment object
 */
ISignThis.prototype.parsePayment = function iSignThisParsePayment(requestBody) {
  return this._convertPaymentObject(requestBody);
};

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
