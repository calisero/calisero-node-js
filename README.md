# Calisero Node.js SMS API Library

[![npm version](https://img.shields.io/npm/v/@calisero/calisero-node.svg?style=flat-square)](https://www.npmjs.com/package/@calisero/calisero-node)
[![CI](https://img.shields.io/github/actions/workflow/status/calisero/calisero-node-js/ci.yml?branch=main&label=tests&style=flat-square)](https://github.com/calisero/calisero-node-js/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/codecov/c/github/calisero/calisero-node-js?style=flat-square)](https://codecov.io/gh/calisero/calisero-node-js)
[![Node.js](https://img.shields.io/node/v/@calisero/calisero-node.svg?style=flat-square)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg?style=flat-square)](https://www.typescriptlang.org)
[![Types](https://img.shields.io/npm/types/@calisero/calisero-node.svg?style=flat-square)](https://www.npmjs.com/package/@calisero/calisero-node)
[![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg?style=flat-square)](package.json)
[![Code style: Biome](https://img.shields.io/badge/code%20style-biome-60a5fa.svg?style=flat-square)](https://biomejs.dev)
[![License](https://img.shields.io/npm/l/@calisero/calisero-node.svg?style=flat-square)](LICENSE.md)
[![Downloads](https://img.shields.io/npm/dm/@calisero/calisero-node.svg?style=flat-square)](https://www.npmjs.com/package/@calisero/calisero-node)

**Official Node.js library for the [Calisero](https://calisero.ro) transactional SMS API.**

Send SMS messages, verify phone numbers with one-time codes, manage opt-outs for GDPR compliance, receive delivery reports and monitor your account, with a Promise-based, fully typed library that has no dependencies.

## Features

- 🚀 **Simple & Intuitive**: `SmsClient.create(apiKey)`, then `client.messages.create({ ... })`
- 🔒 **Type Safe**: written in strict TypeScript, type declarations included
- 🌐 **Zero Dependencies**: built on the `fetch` of Node.js, nothing else to install
- ⚡ **Promise-based**: `async`/`await` everywhere, cancellable with an `AbortSignal`
- 📱 **Complete API Coverage**: messages, verifications (OTP), opt-outs and accounts, checked against the API's OpenAPI document
- 🔐 **OTP / 2FA**: start a verification and validate the code in two calls
- ✂️ **URL Shortening**: shorten the links of a message body and track their clicks
- 📊 **Limits & Tracing**: daily sending limit, request rate limit and the trace ID of every answer and error
- 📬 **Delivery Webhooks**: typed, validated parsing of delivery status callbacks, and a ready handler for `node:http` and Express
- 🛡️ **Error Handling**: an error class for every kind of failure, with the API's message and the trace ID
- 🕐 **Romania Time Handled**: pass a `Date` to schedule a message, it is converted to the time zone the API expects
- 📦 **ESM & CommonJS**: `import` it, or `require()` it on Node.js 20.19+
- 🧪 **Thoroughly Tested**: unit, integration (real HTTP), contract (OpenAPI) and package smoke tests on Node.js 20, 22, 24 and 26, Linux, macOS and Windows
- 📖 **Rich Examples**: 19 runnable examples covering every operation
- 🐘 **Sibling Libraries**: [`calisero/calisero-php`](https://github.com/calisero/calisero-php) and [`calisero/laravel-sms`](https://github.com/calisero/laravel-sms)

## Requirements

- Node.js **20.19 or later** — tested on **20, 22, 24 and 26**
- A Calisero API key

The library carries no runtime dependency: its HTTP client is the `fetch` built into Node.js. It is meant for
server-side code: never ship your API key to a browser.

## Installation

```bash
npm install @calisero/calisero-node
```

With other package managers: `pnpm add @calisero/calisero-node`, `yarn add @calisero/calisero-node`.

## Getting Your API Key

To use this library, you'll need an API key from your Calisero account:

1. **Log in to your Calisero account** at [https://calisero.ro](https://calisero.ro)
2. **Navigate to the dashboard** and go to the **"API Keys"** section
3. **Click "Add Key"** to create a new API key
4. **Configure your key:**
   - Give it a descriptive name (e.g., "Production App", "Development")
   - Set IP filters if needed for additional security
   - Choose a sandbox key to test without sending or paying for real messages
5. **Copy your API key** and store it securely

> **Security Note**: Never commit API keys to version control. Use environment variables or a secret manager.

## Quick Start

### Basic SMS Sending

```js
import { SmsClient } from '@calisero/calisero-node';

// Create the SMS client
const client = SmsClient.create(process.env.CALISERO_API_KEY);

// Send a simple SMS
const { data: message } = await client.messages.create({
    recipient: '+40742***350',
    body: 'Hello from Calisero!',
});

console.log(`Message sent! ID: ${message.id}`);
console.log(`Status: ${message.status}`);
```

CommonJS code loads it with `require()`:

```js
const { SmsClient } = require('@calisero/calisero-node');
```

### Environment Configuration

For production applications, store your API key securely:

```bash
# .env file
CALISERO_API_KEY=your-api-key-here
```

```js
import { SmsClient } from '@calisero/calisero-node';

// Node.js reads a .env file with `node --env-file=.env app.js`
const client = SmsClient.create(process.env.CALISERO_API_KEY);
```

`SmsClient.create()` throws a `TypeError` when the key is missing or empty, so a misconfigured environment fails at
startup rather than on the first message.

## 🎯 Common Use Cases

### OTP / 2FA Authentication

The Verifications API generates the code, sends it by SMS and checks it, so your application never stores it:

```js
import { SmsClient, ValidationError } from '@calisero/calisero-node';

const client = SmsClient.create(process.env.CALISERO_API_KEY);

// 1. Send a code (6 characters, valid for 5 minutes by default)
await client.verifications.create({ phone: '+40742***350', brand: 'YourApp' });

// 2. Check the code the user typed
try {
    const { data: verification } = await client.verifications.validate({ phone: '+40742***350', code: userInput });
    console.log(`Verified at ${verification.verifiedAt}`);
} catch (error) {
    if (error instanceof ValidationError) {
        // A wrong or expired code, or too many attempts (5)
        console.log(error.message);
    } else {
        throw error;
    }
}
```

To send a code you generate yourself, hide it in the API's answers and in the dashboard with `visibleBody`:

```js
await client.messages.create({
    recipient: userPhoneNumber,
    body: 'Your verification code is: AC3-4F6. Valid for 5 minutes.',
    visibleBody: 'Your verification code is: ******. Valid for 5 minutes.',
    sender: 'YourApp',
});
```

### Order Notifications

```js
await client.messages.create({
    recipient: customerPhone,
    body: `Order #${orderNumber} confirmed! Estimated delivery: ${deliveryDate}`,
    callbackUrl: 'https://yourstore.com/webhooks/sms/dlr',
    sender: 'YourStore',
});
```

### Marketing Campaigns with Opt-out Compliance

The API refuses to send to a number that opted out: the message fails validation (422) and is neither sent nor
billed.

```js
import { ValidationError } from '@calisero/calisero-node';

try {
    await client.messages.create({
        recipient: phoneNumber,
        body: 'Special offer! Get 20% off with code SAVE20. Reply STOP to opt out.',
        sender: 'YourBrand',
    });
} catch (error) {
    if (error instanceof ValidationError && error.validationErrors.recipient) {
        console.log(`Not sent to ${phoneNumber}: ${error.validationErrors.recipient.join(' ')}`);
    } else {
        throw error;
    }
}

// When a customer asks to stop receiving messages
await client.optOuts.create({ phone: phoneNumber, reason: 'Replied STOP' });
```

### Advanced Message Creation

```js
const { data: message } = await client.messages.create({
    recipient: '+40742***350',
    body: 'Your code is 123456. Manage alerts: https://yoursite.com/alerts',
    visibleBody: 'Your code is ******. Manage alerts: https://yoursite.com/alerts', // Shown in answers and the dashboard
    validity: 24, // Validity period, in hours
    scheduleAt: new Date('2026-12-25T08:00:00Z'), // Sent at 10:00, Romania time
    callbackUrl: 'https://yoursite.com/webhook', // Delivery reports
    sender: 'Calisero', // One of your approved sender IDs
    shortenUrls: true, // Shorten the links of the body
});
```

`scheduleAt` takes a `Date`, converted to the Romania time the API reads, or a `YYYY-MM-DD HH:MM:SS` string already
in Romania time. A time already past today sends the message at once; the API refuses an earlier day, and accepts up
to 5 years ahead.

## Authentication

### Using an API Key

```js
const client = SmsClient.create('your-api-key-here');
```

### Custom Authentication Provider

Pass an object with a `getToken()` method instead of the key: it is called before every request and may be
asynchronous, e.g. to read the key from a secret manager and rotate it without a restart.

```js
import { SmsClient } from '@calisero/calisero-node';

const client = SmsClient.create({
    getToken: async () => secretManager.read('calisero-api-key'),
});
```

## 📚 Examples

This library includes runnable examples for every operation in the [`examples/`](examples/) directory:

### 📱 Message Examples
- **[`examples/messages/send_simple_sms.mjs`](examples/messages/send_simple_sms.mjs)** - Send a basic SMS message
- **[`examples/messages/send_advanced_sms.mjs`](examples/messages/send_advanced_sms.mjs)** - Scheduling, callbacks, custom sender and URL shortening
- **[`examples/messages/send_bulk_sms.mjs`](examples/messages/send_bulk_sms.mjs)** - Several recipients, stopping at the daily sending limit
- **[`examples/messages/get_sms.mjs`](examples/messages/get_sms.mjs)** - Retrieve a message and its delivery status
- **[`examples/messages/list_sms.mjs`](examples/messages/list_sms.mjs)** - List messages with pagination
- **[`examples/messages/delete_sms.mjs`](examples/messages/delete_sms.mjs)** - Cancel a scheduled message

### 🚫 Opt-out Examples (GDPR Compliance)
- **[`examples/optouts/create_optout.mjs`](examples/optouts/create_optout.mjs)** - Opt a phone number out
- **[`examples/optouts/get_optout.mjs`](examples/optouts/get_optout.mjs)** - Retrieve an opt-out
- **[`examples/optouts/list_optouts.mjs`](examples/optouts/list_optouts.mjs)** - List the opt-outs with pagination
- **[`examples/optouts/update_optout.mjs`](examples/optouts/update_optout.mjs)** - Update an opt-out's reason
- **[`examples/optouts/delete_optout.mjs`](examples/optouts/delete_optout.mjs)** - Remove an opt-out (re-enable SMS)

### ✅ Verification Examples (OTP)
- **[`examples/verifications/create_verification.mjs`](examples/verifications/create_verification.mjs)** - Start a verification (send a code)
- **[`examples/verifications/get_verification.mjs`](examples/verifications/get_verification.mjs)** - Retrieve a verification
- **[`examples/verifications/list_verifications.mjs`](examples/verifications/list_verifications.mjs)** - List verifications with pagination and a status filter
- **[`examples/verifications/validate_verification.mjs`](examples/verifications/validate_verification.mjs)** - Validate a code

### 👤 Account Examples
- **[`examples/account/get_account.mjs`](examples/account/get_account.mjs)** - Account details
- **[`examples/account/check_balance.mjs`](examples/account/check_balance.mjs)** - Credit and daily sending limit, with an analysis

### 📬 Webhook Examples
- **[`examples/webhooks/delivery_webhook.mjs`](examples/webhooks/delivery_webhook.mjs)** - Receive delivery status callbacks

### 🛡️ Error Handling
- **[`examples/error_handling_complete.mjs`](examples/error_handling_complete.mjs)** - Every error class and how to handle it

### 🚀 Running Examples

```bash
git clone https://github.com/calisero/calisero-node-js.git
cd calisero-node-js
npm ci && npm run build
CALISERO_API_KEY=your-api-key-here CALISERO_TEST_PHONE=+40742123456 node examples/messages/send_simple_sms.mjs
```

> **Note**: Examples use masked phone numbers (`+40742***350`) unless `CALISERO_TEST_PHONE` is set. Use a sandbox API
> key to try them without sending real messages.

## API Reference

Every call returns a Promise and takes an optional last argument, `{ signal }`, to cancel it with an `AbortSignal`.
A single resource comes as `{ data, responseMeta }`, a list as `{ data, links, meta, responseMeta }`.

### Messages

#### Send a Message

```js
const response = await client.messages.create({
    recipient: '+40742***350',
    body: 'Hello World!',
});

const message = response.data;
console.log(message.id); // Message UUID
console.log(message.status); // 'scheduled', then 'sent', 'delivered' or 'undelivered'
console.log(message.parts); // Number of SMS parts

// What the answer's headers report
console.log(response.responseMeta.traceId); // The request's trace ID
console.log(response.responseMeta.dailyRemaining); // Messages left today (null: no daily limit)
```

| Option | Type | Description |
|---|---|---|
| `recipient` | `string` | **Required.** Mobile number in E.164 format, e.g. `+40742123456` |
| `body` | `string` | **Required.** The text, at most 1600 characters |
| `visibleBody` | `string` | Shown instead of `body` in the API's answers and the dashboard |
| `validity` | `number` | Validity period, in hours |
| `scheduleAt` | `Date \| string` | When to send it; a string is `YYYY-MM-DD HH:MM:SS`, Romania time |
| `callbackUrl` | `string` | Where Calisero posts the delivery status updates |
| `sender` | `string` | One of your approved sender IDs; the default sender when omitted |
| `shortenUrls` | `boolean` | Shorten the `http(s)://` links of the body |

#### Shorten URLs

Set `shortenUrls` to `true` and Calisero replaces every `http://` and `https://` link of the body with a short one
before sending, so the SMS gets shorter (and may take fewer parts). Each shortened link comes back with its click
statistics:

```js
const { data: message } = await client.messages.create({
    recipient: '+40742***350',
    body: 'Your order has shipped! Track it: https://yourstore.com/orders/12345/tracking',
    shortenUrls: true,
});

for (const link of message.shortenedUrls) {
    console.log(link.originalLink); // https://yourstore.com/orders/12345/tracking
    console.log(link.shortenedLink); // https://calisero.ro/s/ghJKPV
}

// Later: how many times the links were opened
const { data: later } = await client.messages.get(message.id);

for (const link of later.shortenedUrls) {
    console.log(link.clickCount, link.lastClick); // Number of clicks, last click or null
}
```

#### Get Message Details

```js
const { data: message } = await client.messages.get('message-uuid-here');

console.log(message.recipient, message.body, message.status);
console.log(message.sentAt, message.deliveredAt);
```

#### List Messages

```js
const page = await client.messages.list(); // Newest first, 50 a page

for (const message of page.data) {
    console.log(`${message.id}: ${message.body}`);
}

console.log(`Current page: ${page.meta.currentPage}`);

if (page.hasNextPage) {
    const next = await client.messages.list({ page: page.meta.currentPage + 1 });
}
```

#### Delete a Message

Only a message still scheduled can be cancelled:

```js
import { ForbiddenError } from '@calisero/calisero-node';

try {
    await client.messages.delete('message-uuid-here');
    console.log('Message cancelled');
} catch (error) {
    if (error instanceof ForbiddenError) {
        console.log('Cannot delete: the message is already queued, sent or delivered');
    } else {
        throw error;
    }
}
```

### Verifications (OTP)

#### Create a Verification

```js
const response = await client.verifications.create({
    phone: '+40742***350',
    brand: 'Calisero', // Named in the default message; required unless a template is given
    // template: 'Your Calisero code is {code}', // Or a message of your own, holding {code}
    // expiresIn: 10, // Minutes the code stays valid, 1 to 10 (5 by default)
});

const verification = response.data;
console.log(verification.id, verification.status); // 'unverified'
console.log(verification.expiresAt);

// The code's SMS counts towards the account's daily sending limit
console.log(response.responseMeta.dailyRemaining);
```

#### Get Verification Details

```js
const { data: verification } = await client.verifications.get('verification-uuid-here');

console.log(verification.status); // 'unverified' or 'verified'
console.log(verification.verifiedAt); // Timestamp or null
console.log(verification.expired, verification.attempts);
```

#### List Verifications

```js
// Optionally only the 'verified' or the 'unverified' ones
const page = await client.verifications.list({ page: 1, status: 'verified' });

for (const verification of page.data) {
    console.log(`${verification.id} | ${verification.phone} | ${verification.status}`);
}
```

#### Validate a Verification Code (OTP)

The code is checked against the latest verification of the phone number, in any case:

```js
const { data: verification } = await client.verifications.validate({
    phone: '+40742***350',
    code: 'ABC123',
});

console.log(verification.status); // 'verified' (checking a verified code again succeeds)
```

A wrong or expired code, or a sixth attempt, rejects with a `ValidationError` whose `validationErrors.code` says
which; a phone number without a verification with a `NotFoundError`.

### Opt-outs

#### Create an Opt-out

```js
const { data: optOut } = await client.optOuts.create({
    phone: '+40742***350',
    reason: 'User requested opt-out via website',
});

console.log(`Opt-out created with ID: ${optOut.id}`);
```

#### List Opt-outs

```js
const page = await client.optOuts.list();

for (const optOut of page.data) {
    console.log(`${optOut.phone}: ${optOut.reason ?? 'no reason'}`);
}
```

#### Get, Update and Delete an Opt-out

```js
const { data: optOut } = await client.optOuts.get('optout-uuid-here');

await client.optOuts.update('optout-uuid-here', { phone: optOut.phone, reason: 'Updated reason' });

// The number can receive messages again
await client.optOuts.delete('optout-uuid-here');
```

### Accounts

```js
const { data: account } = await client.accounts.get('account-uuid-here');

console.log(`Account: ${account.name}`);
console.log(`Credit: ${account.credit}`);
console.log(`Status: ${account.status}`); // 'active', 'pending' or 'disabled'
console.log(`Sandbox: ${account.sandbox ? 'Yes' : 'No'}`);

// Daily sending limit (null when no daily limit applies)
console.log(`Daily limit: ${account.dailyLimit ?? 'none'}`);
console.log(`Left today: ${account.dailyRemaining ?? 'unlimited'}`);
console.log(`Sent today: ${account.sentToday}`);
```

### Delivery Status Webhooks

When a message has a `callbackUrl`, Calisero posts a JSON payload to it each time the message's status changes
(`sent`, `delivered` or `undelivered`). Answer with any 2xx status within 2 seconds: only a failed connection or a
slower answer is retried (at most 5 attempts in total), a non-2xx answer is not.

`createDeliveryWebhookHandler()` gives you a ready request handler: it reads and validates the payload, hands it to
your `onMessage` as a typed `DeliveryWebhookMessage`, and answers.

```js
import { createServer } from 'node:http';
import { createDeliveryWebhookHandler } from '@calisero/calisero-node';

const handler = createDeliveryWebhookHandler({
    // Optional: accept only callback URLs that carry ?token=<this secret>
    token: process.env.CALISERO_WEBHOOK_TOKEN,

    onMessage: async (message) => {
        console.log(message.messageId); // The message's UUID
        console.log(message.status); // 'sent', 'delivered' or 'undelivered'
        console.log(message.deliveredAt); // Set for 'delivered'
        console.log(message.price); // Price charged for the message's parts
        console.log(message.remainingBalance); // Account balance after billing
        console.log(message.dailyRemaining); // Messages left today when it was sent (null: no daily limit)
        // Keep it short (update a record, queue a job): the answer waits for it
    },

    onError: (error) => console.error(error), // A refused callback, or a failed onMessage
});

createServer(handler).listen(8080);
```

With **Express**, mount it on a route, with or without `express.json()` before it:

```js
app.post('/webhooks/calisero', createDeliveryWebhookHandler({ onMessage, token: process.env.CALISERO_WEBHOOK_TOKEN }));
```

Then send the URL with the secret as each message's callback URL:
`callbackUrl: 'https://yourapp.com/webhooks/calisero?token=' + process.env.CALISERO_WEBHOOK_TOKEN`.

| Answer | When |
|---|---|
| `200 {"received":true}` | `onMessage` handled the update |
| `400` / `413` | The payload is not a delivery status update / is larger than `maxBodySize` (64 KiB) |
| `401` | `token` is set and the request URL lacks it (compared in constant time) |
| `405` | Not a POST |
| `500` | `onMessage` threw |

Calisero does not sign its callbacks, which is why the handler checks a secret token in the URL instead. In another
framework, read the payload yourself with `DeliveryWebhookMessage.fromJson(rawBody)` or
`DeliveryWebhookMessage.fromObject(parsedBody)`: both throw an `InvalidWebhookPayloadError` for a malformed payload
(and for the `[]` Calisero sends when the message was cancelled meanwhile).

## Daily Sending Limit

Every account has its own daily sending limit: how many messages it can send in a day. A new account starts with a
default limit and keeps it until Calisero raises it on request.

- Every real message counts once, whatever its number of parts: the messages of `messages.create()` and the codes
  of `verifications.create()` alike. A scheduled message counts on the day it is created.
- Test messages (a sandbox account or a sandbox API key) never count and are never refused.
- The day ends at midnight, Romania time (Europe/Bucharest), whatever time zone you send from.

You can see the limit and what is left of it in three places:

```js
// 1. On the account
const { data: account } = await client.accounts.get('account-uuid-here');
console.log(account.dailyLimit, account.dailyRemaining, account.sentToday); // e.g. 1000, 873, 127

// 2. After every message or verification created (X-Daily-Limit / X-Daily-Remaining)
const { responseMeta } = await client.messages.create({ recipient: '+40742***350', body: 'Hello!' });
console.log(responseMeta.dailyLimit, responseMeta.dailyRemaining); // e.g. 1000, 872 (after this message)

// 3. In every delivery status callback: message.dailyLimit, message.dailyRemaining, message.sentToday
```

Once the limit is reached, new messages and verifications are refused with a `DailyLimitExceededError` until
midnight, Romania time. Nothing is sent and nothing is billed:

```js
import { DailyLimitExceededError } from '@calisero/calisero-node';

try {
    await client.messages.create(request);
} catch (error) {
    if (error instanceof DailyLimitExceededError) {
        console.log(error.message); // What happened and when the limit resets
        console.log(error.dailyLimit); // e.g. 1000
        console.log(error.dailyRemaining); // 0
        console.log(error.resetsAt); // e.g. 2026-10-01T00:00:00+03:00
        console.log(error.retryAfter); // Seconds until the reset
    }
}
```

To raise the limit, contact Calisero with your account and the daily volume you expect.

## Rate Limits & Trace ID

### Request Rate Limit

Separately from the daily sending limit, each API user may make **240 requests a minute**, on every endpoint. Above
that the API answers `429` and the library throws a `RateLimitedError`:

```js
import { setTimeout as sleep } from 'node:timers/promises';
import { DailyLimitExceededError, RateLimitedError } from '@calisero/calisero-node';

try {
    await client.messages.create(request);
} catch (error) {
    if (error instanceof DailyLimitExceededError) {
        // The daily sending limit: wait until error.resetsAt
    } else if (error instanceof RateLimitedError) {
        // The request rate limit: wait a few seconds and retry
        await sleep((error.retryAfter ?? 1) * 1000);
        console.log(error.rateLimitLimit); // 240
        console.log(error.rateLimitRemaining); // 0
        console.log(error.rateLimitReset); // Unix timestamp when requests are accepted again
    }
}
```

`DailyLimitExceededError` extends `RateLimitedError`, so check it first. After any successful call,
`responseMeta.rateLimitRemaining` tells how many requests are left in the current minute.

### Trace ID

Every API answer carries the request's trace ID. Log it: quoting it to support lets Calisero find the request at once,
and the dashboard shows everything that happened to it under **Developers → Debug**.

```js
import { ApiError } from '@calisero/calisero-node';

// On success
const { responseMeta } = await client.messages.create(request);
console.log(responseMeta.traceId);

// On error
try {
    await client.messages.create(request);
} catch (error) {
    if (error instanceof ApiError) {
        console.error(`Calisero request ${error.traceId} failed: ${error.message}`);
    }
}
```

## Error Handling

Every error the API answers with is an `ApiError`, of the subclass that matches its status:

```js
import {
    ApiError,
    DailyLimitExceededError,
    NotFoundError,
    RateLimitedError,
    ServerError,
    TransportError,
    UnauthorizedError,
    ValidationError,
} from '@calisero/calisero-node';

try {
    await client.messages.create({ recipient: '+40742***350', body: 'Test message' });
} catch (error) {
    if (error instanceof UnauthorizedError) {
        console.log('Invalid or revoked API key'); // 401
    } else if (error instanceof ValidationError) {
        console.log(`Validation error: ${error.message}`); // 422
        for (const [field, messages] of Object.entries(error.validationErrors)) {
            console.log(`${field}: ${messages.join(', ')}`);
        }
    } else if (error instanceof DailyLimitExceededError) {
        console.log(`Daily limit reached. Sending resumes at: ${error.resetsAt}`); // 429
    } else if (error instanceof RateLimitedError) {
        console.log(`Rate limited. Retry after: ${error.retryAfter} seconds`); // 429
    } else if (error instanceof ServerError) {
        console.log(`Server error: ${error.message}`); // 5xx
    } else if (error instanceof TransportError) {
        console.log(`Network error: ${error.message}`, error.cause); // No answer
    } else if (error instanceof ApiError) {
        console.log(`API error ${error.statusCode}: ${error.message} (trace ID: ${error.traceId})`);
    } else {
        throw error;
    }
}
```

Every `ApiError` carries the API's own error message (`message`), the HTTP status (`statusCode`), the request's
trace ID (`traceId`; `requestId` returns the same value) and the decoded error body (`errorDetails`).

| Error | When |
|---|---|
| `UnauthorizedError` | `401`: invalid, revoked or missing API key, or a request from an IP the key does not allow |
| `ForbiddenError` | `403`: not allowed, e.g. deleting a message already sent, or another account's resource |
| `NotFoundError` | `404`: the resource does not exist |
| `ValidationError` | `422`: invalid request data; field errors in `validationErrors` |
| `DailyLimitExceededError` | `429`: the account reached its daily sending limit |
| `RateLimitedError` | `429`: more than 240 requests a minute |
| `ServerError` | `500`, `502`, `503`, `504` |
| `ApiError` | Any other API error, or an answer the library cannot read; base class of the above |
| `TransportError` | The request got no answer: network error, timeout or abort (the original error is its `cause`) |

Arguments that cannot be sent at all (an empty id, a page that is not a positive integer, an invalid `Date`) throw a
`TypeError` or a `RangeError` before any request is made.

### Retries

The library never retries a request on its own. The API takes no idempotency key, so a message retried after a
timeout or a server error may already have been sent: check with `messages.list()` before sending it again. The API
itself refuses (422, `duplicate_sms`) the same message to the same recipient sent again within 5 seconds.

## Advanced Configuration

### Client Options

```js
const client = SmsClient.create(process.env.CALISERO_API_KEY, {
    timeout: 10_000, // Milliseconds to wait for each answer (30 000 by default)
    baseUrl: 'https://rest.calisero.ro/api/v1', // The default
    appInfo: { name: 'MyShop', version: '2.1.0' }, // Named in the User-Agent header
});
```

Every request goes to `https://rest.calisero.ro/api/v1` with a 30-second timeout and the headers
`Authorization: Bearer <key>`, `Accept: application/json`, `Content-Type: application/json` and the
[`User-Agent`](#user-agent) below. Redirects are not followed, so the API key never goes to another host.

### User-Agent

Every request names the library and its version, then the runtime, so Calisero can tell its requests apart and see
which version sent them:

```
User-Agent: Calisero-SMS-Node/1.0.1 (Node.js v24.21.0; linux x64)
```

A request whose `User-Agent` starts with `Calisero-SMS-Node/` comes from this library. Give your application's name
with `appInfo` and it follows, so the requests of each of your applications can be told apart too:

```js
const client = SmsClient.create(process.env.CALISERO_API_KEY, { appInfo: { name: 'MyShop', version: '2.1.0' } });

console.log(client.httpClient.userAgent);
// Calisero-SMS-Node/1.0.1 (Node.js v24.21.0; linux x64) MyShop/2.1.0
```

Characters a header does not allow (spaces, diacritics…) become `-` in the name and the version.

### Through a Proxy

Pass the `fetch` of [undici](https://github.com/nodejs/undici) with a proxy agent:

```js
import { ProxyAgent, fetch } from 'undici';

const dispatcher = new ProxyAgent('http://proxy.internal:3128');
const client = SmsClient.create(process.env.CALISERO_API_KEY, {
    fetch: (url, init) => fetch(url, { ...init, dispatcher }),
});
```

### Cancelling a Request

```js
// Give up after 5 seconds, or when the incoming request is aborted
const { data } = await client.messages.list({}, { signal: AbortSignal.timeout(5_000) });
```

A cancelled call rejects with a `TransportError` whose `cause` is the `AbortError`.

### Custom Transport

A transport sends a request and returns the answer, whatever its status. Write your own to log the traffic, add
headers, or plug in another HTTP client:

```js
import { FetchTransport, SmsClient } from '@calisero/calisero-node';

const fetchTransport = new FetchTransport({ timeout: 15_000 });

const client = SmsClient.create(process.env.CALISERO_API_KEY, {
    transport: {
        async send(request) {
            const startedAt = Date.now();
            const response = await fetchTransport.send(request);
            console.log(`${request.method} ${request.url} → ${response.status} in ${Date.now() - startedAt} ms`);

            return response;
        },
    },
});
```

### Building the Client Yourself

`SmsClient.create()` covers the usual needs. For anything else, build the `HttpClient` yourself: its `lastResponse`
is the raw answer to the last request, headers included.

```js
import { BearerTokenAuthProvider, FetchTransport, HttpClient, SmsClient } from '@calisero/calisero-node';

const httpClient = new HttpClient({
    authProvider: new BearerTokenAuthProvider(process.env.CALISERO_API_KEY), // Or your own { getToken() }
    transport: new FetchTransport({ timeout: 60_000 }),
    baseUrl: 'https://rest.calisero.ro/api/v1',
});

const client = new SmsClient(httpClient);
await client.accounts.get('account-uuid-here');

console.log(httpClient.lastResponse?.getHeaderLine('X-Trace-Id'));
```

## TypeScript

The library is written in TypeScript and ships its type declarations: requests, responses, resources and errors are
all typed.

```ts
import { type CreateMessageRequest, type Message, SmsClient } from '@calisero/calisero-node';

const request: CreateMessageRequest = { recipient: '+40742***350', body: 'Hello!' };
const message: Message = (await SmsClient.create(apiKey).messages.create(request)).data;
```

Statuses are typed as their known values (`MessageStatus`, `VerificationStatus`, `AccountStatus`, `DeliveryStatus`)
while still accepting values a future API version may add.

The package is an ES module. TypeScript code compiled to CommonJS loads it with `"module": "nodenext"` and
TypeScript 5.8 or later, which know that Node.js can `require()` it.

## Testing

```bash
npm test                 # Run the tests
npm run test:coverage    # With a coverage report in coverage/
npm run lint             # Code style (Biome)
npm run typecheck        # TypeScript, strict
npm run qa               # Everything CI runs: lint, types, tests, build, package smoke tests, examples
```

[TESTING.md](TESTING.md) describes the suite: unit tests, integration tests over real HTTP against a local server,
contract tests against the API's OpenAPI document, and smoke tests of the built package.

### Testing Your Implementation

Give the client a stub transport: your tests then run without the network and see every request.

```js
import { HttpResponse, SmsClient } from '@calisero/calisero-node';
import { expect, test } from 'vitest';

test('sends the order confirmation', async () => {
    const requests = [];
    const client = SmsClient.create('test-key', {
        transport: {
            async send(request) {
                requests.push(request);

                return new HttpResponse(201, {}, JSON.stringify({
                    data: {
                        id: '9e2574e8-3615-4090-9b5a-0fc812079da8',
                        recipient: '+40742***350',
                        body: 'Order #1001 confirmed!',
                        parts: 1,
                        created_at: '2025-02-06T10:18:43.000000Z',
                        status: 'scheduled',
                    },
                }));
            },
        },
    });

    await sendOrderConfirmation(client, order); // Your code

    expect(JSON.parse(requests[0].body)).toEqual({ recipient: '+40742***350', body: 'Order #1001 confirmed!' });
});
```

To test error handling, answer with the error the API sends, e.g.
`new HttpResponse(422, {}, JSON.stringify({ message: 'The recipient field is required.', errors: { recipient: ['The recipient field is required.'] } }))`.

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to contribute to this project.

## Security

If you discover any security-related issues, please email support@calisero.ro instead of using the issue tracker.

## License

This library is open-sourced software licensed under the [MIT license](LICENSE.md).

## Support

- 📧 Email: support@calisero.ro
- 📖 Documentation: [https://docs.calisero.ro](https://docs.calisero.ro)
- 🐛 Issues: [GitHub Issues](https://github.com/calisero/calisero-node-js/issues)

## Changelog

Please see [CHANGELOG.md](CHANGELOG.md) for more information on what has changed recently.
