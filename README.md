# isignthis-psp

**UPDATE 2.x.x:** Node-style callbacks are deprecated, but can still be found in versions 1.x.x

_Module for interfacing with iSignThis as a payment service provider (PSP)_

## _Constructor_
<a name="module-constructor"></a>

_Module constructor_

#### Arguments

Argument   | Type   | Default    | Description
---------- | ------ | ---------- | -----------
`settings` | Object | _Required_ | An object of settings required or supported by the module.

###### `option` object

Field      | Type   | Default    | Description
---------- | ------ | ---------- | -----------
`clientCertificate` | Buffer | _Required_ | Client certificate used for communication
`clientKey` | Buffer | _Required_ | Client private key used for communication
`merchantId` | String | _Required_ | iSignThis merchant identifier
`log` | Object | [`console-log-level`](https://www.npmjs.com/package/console-log-level) instance | Bunyan-compatible logger
`baseUrl` | String | `"https://gateway.isignthis.com"` | Base URL (without trailing slash) to iSignThis to use instead of default
`acquirerId` | String | `"node-isignthis-psp"` | Default acquirer to use if none specified when creating a payment

#### Example

```javascript
var fs = require('fs');
var ISignThis = require('isignthis-psp');

var iSignThis = new ISignThis({
  clientCertificate: fs.readFileSync(certFile),
  clientKey: fs.readFileSync(keyFile),
  merchantId: "my_merchant",
  acquirerId: "clearhaus"
});
```

## Payments
<a name="module-payment"></a>

#### Payment object
<a name="module-payment-object"></a>

_This section describes the object that is returned on success from [`createPayment`](#module-payment-create) and [`getPayment`](#module–payment-read)._

Field         | Type      | Description
------------- | --------- | -----------
`id`          | String    | PSP-specific identifier for this payment
`acquirerId`  | String    | Acquirer used for this payment? (`options.acquirerId` as passed to the _constructor_)
`state`       | String    | State of the payment. Is one of the following strings: <ul><li>`pending` - Payment has been initiated, but is waiting for action from the PSP or the end-user.</li><li>`rejected` - Payment was rejected before the end-user entered any payment details.</li><li>`declined` - Payment was declined after the end-user entered payment details.</li><li>`failed` - Payment failed due to an error with the PSP.</li><li>`expired` - Payment expired before it was completed.</li><li>`completed` - Payment completed successfully.</li></ul>
`expiryTime` | Date | Time when payment expires in ISO-8601 format
`redirectUrl` | String | URL where the payment is processed by the user.
`transactions` | Object    | Information about the transaction(s) related to the payment
&rarr;`id`     | String    | Acquirer-specific identifier for this transaction.
&rarr;`amount` | Integer   | Amount (denominated in sub-unit of &rarr;`currency`) of this transaction
&rarr;`currency` | String  | Currency denominating `amount`
&rarr;`identity` | Object  | Information about the KYC/SCA identity returned with the transaction. If no identity is returned, value will be `null`
&rarr;`identity.id` | String  | Identity ID
&rarr;`identity.url` | String  | URL to get provider specific identity information
`raw`         | Object    | The payment object from the PSP. The contents of this object will differ between different PSPs, and should be treated as an opaque blob.
`card`          | Object  | Information about the card
&rarr;`token`   | String  | The credit card token to use for a preauthorized card payment
&rarr;`last4`   | String  | The last four digits of the credit card number
&rarr;`bin`     | String  | The credit card bin
&rarr;`brand`   | String  | The credit card brand
&rarr;`expiryDate`   | String  | The credit card expiry date (e.g. `1217` for Dec, 2017)
&rarr;`recurringId`   | String  | ID to use for recurring payments.

### `createPayment`: Create payment
<a name="module–payment-create"></a>

_Initiate a payment_

`createPayment(options)`

#### `options` arguments

Argument      | Type   | Default    | Description
------------- | ------ | ---------- | -----------
`acquirerId`  | String | `acquirerId` from constructor | What acquirer should be used for this payment?
`returnUrl`   | String (URL fragment) | _Required_ | URL to redirect end-user to after a successful payment. **Note**: The PSP transaction ID will be appended to the URL, so it should be something like `https://example.com/payment-complete?transaction_id=`
`amount`     | Integer | _Required_ | Amount (denominated in sub-unit of `currency`) to create a payment for.
`currency`   | String  | _Required_ | Currency code denominating `amount`.
`client`     | Object  | _Required_ | Object with information about the client initiating the payment. Only the `ip` field is required.
`initRecurring` | Boolean  | _(Optional)_  | If payment is the first in a series of recurring payments.
&rarr;`ip`   | String  | _Required_ | IP address of client
&rarr;`userAgent`  | String  | _Required_ | Client user agent
&rarr;`name` | String  | `null`     | Full name of client
&rarr;`dob`  | String   | `null`     | Date of birth of client
&rarr;`country`  | String  | `null`     | Country code (ISO-3166-1 alpha-2) of country of citizenship of client
&rarr;`email`   | String (Email address) | `null`     | Email address of client
&rarr;`address` | String  | `null`     | Physical street address of client
`account`       | Object  | _Required_ | Object with information about the account (e.g. the internal user or equivalent)
&rarr;`id`      | String  | _Required_ | Unique identifier for this account (e.g. internal user ID or equivalent)
&rarr;`secret`  | String  | `null`     | Secret used by iSignThis
&rarr;`name`    | String  | `null`     | Full name of account owner
`transaction`   | Object  | `{}`       | Information about the transaction(s) related to the payment
&rarr;`id`      | String  | `null`     | ???
&rarr;`reference` | String  | `null`   | Internal reference for the transaction(s)
`card`          | Object  | _(Optional) | Information about the card
&rarr;`token`   | String  | `null`   | The credit card token to use for a preauthorized card payment


#### Returns

The function return a Promise which resolves in a [payment object](#module-payment-object).

#### Example

```javascript
var options = {
  acquirerId: 'clearhaus',
  returnUrl: 'https://example.com/payment-complete?transaction_id=',
  amount: 5000,
  currency: 'USD', // 50.00 USD
  client: {
    ip: '127.0.0.1',
    userAgent: 'Mozilla/5.0 (iPad; U; CPU OS 3_2_1 like Mac OS X; en-us) AppleWebKit/531...'
  },
  account: {
    id: 'user-12345'
  }
};

return PSP.createPayment(options)
  .then(payment => {
    // Handle payment creation success
  })
  .catch(err => {
    // Handle error
  });
});
```

### `getPayment`: Read payment
<a name="module–payment-read"></a>

_Get updated information about an existing payment_

`getPayment(paymentId);`

#### Arguments

Argument      | Type   | Default    | Description
------------- | ------ | ---------- | -----------
`paymentId`   | String | _Required_ | ID of payment to query. Comes from the `id` property of the [payment object](#module-payment-object).

#### Returns

The function return a Promise which resolves in a [payment object](#module-payment-object).

#### Example

```javascript
var paymentId = '12345678-4321-2345-6543-456787656789';
return PSP.getPayment(options)
  .then(payment => {
    // Handle payment creation success
  })
  .catch(err => {
    // Handle error
  });
});
```

### `isCallbackValid`: Validate callback
<a name="module–callback-validate"></a>

_Validate a callback sent from iSignThis._

`isCallbackValid(request);`

#### Arguments

Argument      | Type   | Default    | Description
------------- | ------ | ---------- | -----------
`request`     | Object | _Required_ | Whole request object with headers and body.

#### Returns

Returns true if callback is valid

#### Example

```javascript
const request = {
  headers: {
  	 'content-type': 'application/json',
	  accept: 'application/json',
	  host: 'example.com',
	  authorization: 'Bearer token_value',
	  'content-length': '1297',
	  connection: 'close',
  },
  body: {}
};

// Result is either true or false
const result = isCallbackValid(request);
```

### `parsePayment`: Read payment
<a name="module–payment-parse"></a>

_Get updated information about an existing payment_

`parsePayment(requestBody);`

#### Arguments

Argument      | Type   | Default    | Description
------------- | ------ | ---------- | -----------
`requestBody` | Object | _Required_ | Body of the request object. In this case its a payment object from iSignThis.

#### Result

This function returns a [payment object](#module-payment-object).

#### Example

```javascript
const requestBody = {
  id: "c97f0bfc-c1ac-46c3-96d8-6605a63d380d",
  uid: "c97f0bfc-c1ac-46c3-96d8-6605a63d380d",
  secret: "f8fd310d-3755-4e63-ae98-ab3629ef245d",
  mode: "registration",
  original_message: {
    merchant_id: merchantId,
    transaction_id: transactionId,
    reference: transactionReference
  },
  expires_at: "2016-03-06T13:36:59.196Z",
  transactions: [
    {
      acquirer_id: acquirerId,
      bank_id: "2774d451-5499-41a6-a37e-6a90f2b8673c",
      response_code: "20000",
      success: true,
      amount: "0.70",
      currency: "DKK",
      message_class: "authorization-and-capture",
      status_code: "20000"
    },
    {
      acquirer_id: acquirerId,
      bank_id: "73f63c0b-7c59-416f-89e5-17dcc38b64ac",
      response_code: "20000",
      success: true,
      amount: "0.30",
      currency: "DKK",
      message_class: "authorization-and-capture",
      status_code: "20000"
    }
  ],
  state: "PENDING",
  compound_state: "PENDING.AWAIT_SECRET"
}

// result is a payment object
const payment = PSP.parsePayment(requestBody);
```
