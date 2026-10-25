# AGENTS.md: @calisero/calisero-node

Guidance for AI coding agents. Calisero is a Romanian transactional SMS API (base URL
`https://rest.calisero.ro/api/v1`, `Authorization: Bearer <API key>`). `@calisero/calisero-node` is its official
Node.js library: TypeScript, no runtime dependency (the built-in `fetch`), ESM and CommonJS, Node.js 20.19 or later.

- **Using this library**: you are adding Calisero to an application.
- **Working on this library**: you are changing this repository.

Every name below exists in `src/` (exported from `src/index.ts`); `README.md` documents each call in full.

## Using this library

### Install and configure

```bash
npm install @calisero/calisero-node
```

The library reads no environment variable: pass the API key to `SmsClient.create()`. By convention the application
reads it from `CALISERO_API_KEY`. Never hard-code the key, never ship it to a browser, use one key per environment.

```js
import { SmsClient } from '@calisero/calisero-node'; // or: const { SmsClient } = require('@calisero/calisero-node');

const client = SmsClient.create(process.env.CALISERO_API_KEY); // a missing or empty key throws a TypeError
```

Create the client once and share it. Options (second argument): `timeout` (milliseconds, 30 000 by default),
`baseUrl`, `appInfo: { name, version }`, `fetch`, `transport`. Instead of the key you may pass an object with a
`getToken()` method (sync or async), called before every request. Every call takes an optional last argument
`{ signal }` (an `AbortSignal`).

### Send an SMS

```js
const { data: message, responseMeta } = await client.messages.create({
    recipient: '+40712345678', // E.164
    body: 'Your order #1001 has shipped.', // at most 1600 characters
    // sender: 'MyShop',                  // only a sender approved for the account
    // scheduleAt: new Date(Date.now() + 3_600_000), // a Date, converted to Romania time
    // callbackUrl: `https://example.com/webhooks/calisero?token=${process.env.CALISERO_WEBHOOK_TOKEN}`,
    // shortenUrls: true, visibleBody: '...', validity: 24 (hours)
});

console.log(message.id, message.status, message.parts, responseMeta.traceId);
```

Keep `message.id`: it matches the delivery callbacks. `responseMeta.dailyRemaining` (`null` without a daily limit)
says how many messages the account can still send today.

### OTP: send and validate

Calisero generates the code (6 characters, letters and digits, case-insensitive), sends it and checks it: never
generate or store it yourself.

```js
import { ValidationError } from '@calisero/calisero-node';

await client.verifications.create({ phone: '+40712345678', brand: 'MyShop' });
// or template: 'Your MyShop code is {code}'; expiresIn: 1 to 10 minutes (5 by default)

try {
    const { data: verification } = await client.verifications.validate({ phone, code: input });
    // verification.status === 'verified'
} catch (error) {
    if (error instanceof ValidationError) {
        // wrong or expired code, or too many attempts (422): error.message says which
    } else {
        throw error;
    }
}
```

### Read a message's status

```js
const { data: message } = await client.messages.get(messageId);
// message.status: 'scheduled', 'sent', 'delivered', 'undelivered'...; message.sentAt, message.deliveredAt
```

`client.messages.list({ page: 2 })` lists messages (50 a page); `client.messages.delete(id)` cancels a message that is
still scheduled. A message that stays `sent` was not confirmed by the carrier, which does not mean it failed.

### Delivery webhook

Set `callbackUrl` on the message, then mount `createDeliveryWebhookHandler()` (works with `node:http` and Express,
with or without `express.json()`):

```js
import { createDeliveryWebhookHandler } from '@calisero/calisero-node';

app.post('/webhooks/calisero', createDeliveryWebhookHandler({
    token: process.env.CALISERO_WEBHOOK_TOKEN, // the callback URL must carry ?token=<this>
    onMessage: async (message) => {
        // message.messageId, message.status ('sent' | 'delivered' | 'undelivered'), message.deliveredAt,
        // message.price, message.remainingBalance, message.dailyRemaining
        await deliveries.enqueue(message.messageId, message.status); // store or enqueue, then return
    },
    onError: (error) => console.error(error),
}));
```

The handler answers after `onMessage` resolves, and Calisero waits 2 seconds: keep it fast. If `onMessage` throws,
the handler answers `500`, which Calisero does not retry: persist first, process later. In another framework, parse
the body with `DeliveryWebhookMessage.fromJson(rawBody)` or `DeliveryWebhookMessage.fromObject(parsedBody)` (an
`InvalidWebhookPayloadError` for a malformed one).

### Errors and the trace ID

Every API error is an `ApiError` (`message`, `statusCode`, `traceId`, `errorDetails`), of the subclass of its status:

| Class | When |
| --- | --- |
| `UnauthorizedError` | 401: missing, invalid or revoked API key |
| `ForbiddenError` | 403: not allowed, e.g. deleting a message that is no longer scheduled |
| `NotFoundError` | 404: unknown ID |
| `ValidationError` | 422: `validationErrors` maps each field to its messages |
| `DailyLimitExceededError` | 429 with `daily_limit_exceeded` (`dailyLimit`, `resetsAt`); extends `RateLimitedError`, so check it first |
| `RateLimitedError` | 429: request rate limit, wait `retryAfter` seconds |
| `ServerError` | 500, 502, 503, 504 |
| `TransportError` | no answer: network error, timeout or abort (`cause` holds the original error) |

Invalid arguments throw a `TypeError` or `RangeError` before any request. Log `error.traceId` with every failure and
`responseMeta.traceId` with every success. Every answer carries it as `X-Trace-Id` (an error body also as `trace_id`);
the dashboard's Developers → Debug page shows everything that happened to that request.

### Tests

- Unit tests: give the client a stub `transport` that returns `new HttpResponse(status, headers, body)` (see
  "Testing Your Implementation" in `README.md`).
- Staging and CI against the real API: use a sandbox API key. It goes through the same validation but sends nothing,
  bills nothing and never counts towards the daily limit; the message is `delivered` at once, callbacks still arrive,
  and a test OTP code shows in the dashboard.

### Rules that matter

- **Phone numbers** in E.164: `+40712345678`, not `0712345678`. Normalise user input before sending.
- **Length and cost**: one part holds 160 GSM-7 characters, or 70 when the text has Romanian diacritics (ă, â, î, ș,
  ț) or emoji (UCS-2). A longer text is split into parts, each billed as one SMS (`parts` on the message); `body`
  takes at most 1600 characters. When cost matters, a text without diacritics keeps 160-character parts: an option,
  not a rule.
- **Sender ID**: alphanumeric, at most 11 characters, approved for the account and written exactly as approved;
  otherwise 422 and nothing is sent. Omit `sender` for the default sender. It cannot receive replies. Never take it
  from user input. OTP codes go out from the shared "Verify" sender and need no sender of your own.
- **Scheduling**: the API reads `schedule_at` as `YYYY-MM-DD HH:MM:SS`, Romania time (Europe/Bucharest). Pass a
  `Date` and the library converts it; a string is sent as is and must already be in that format and time zone.
- **Webhooks**: answer any 2xx within 2 seconds, do the work afterwards. Only a timeout or a failed connection is
  retried (at most 5 attempts); a non-2xx answer is not. The same update can arrive twice and out of order: key your
  processing on `messageId` + `status`, and never move a message back from `delivered`. `callbackUrl` must be a public
  http(s) URL: private, loopback and link-local addresses are refused.
- **429 has two meanings**: the request rate limit (240 requests a minute; retry after `retryAfter`) and the daily
  sending limit (`DailyLimitExceededError`: nothing sent, retrying the same day will not help; it resets at midnight,
  Romania time, `resetsAt`). Created messages and verifications report `X-Daily-Limit` / `X-Daily-Remaining` in
  `responseMeta`.
- **No idempotency key**: the library never retries, and you should not retry `messages.create()` blindly after a
  timeout or a `TransportError`: the SMS may have been sent and billed. Check `messages.list()` first. Do not wrap
  sends in a generic retry helper or a queue with automatic retries.
- **OTP**: `brand` or a `template` holding `{code}`, neither with links. Each code is a billed SMS that counts towards
  the daily limit: rate-limit resends in your application.

## Working on this library

Read `CONTRIBUTING.md` (standards, release) and `TESTING.md` (the suite) before changing code.

- **Layout**: `src/SmsClient.ts` (entry point), `src/services/` (one service per resource), `src/dto/`,
  `src/errors.ts`, `src/http/` (transport, headers, User-Agent), `src/webhooks/`, `src/internal/` (Romania time, JSON
  reading); public exports in `src/index.ts`. Tests in `tests/` (`unit`, `integration`, `contract`, `support`),
  runnable examples in `examples/`, package smoke tests in `scripts/`.
- **OpenAPI**: `resources/openApi/api-v1.json` is the API's contract. Field names, types and status codes come from
  it, and `tests/contract/openapi.test.ts` checks the library against it.
- **Checks**:

  ```bash
  npm ci
  npm run qa          # lint (Biome), typecheck, test, build, smoke, examples:check: what CI runs
  npm test            # Vitest; CI fails below the coverage thresholds of vitest.config.ts
  npm run format      # fix the code style
  ```

- **Conventions**: strict TypeScript (no `any`), Biome style (4 spaces, single quotes, 120 columns), no runtime
  dependency, only what Node.js 20.19 offers. No test may reach the network: services run on a stub transport, the
  HTTP layer on a local server. Build fixtures from what the API really sends.
- **Package contents**: `files` in `package.json` decides what npm publishes (`dist`, `src`, `CHANGELOG.md`,
  `AGENTS.md`; README and license are always included).
- **Changelog and version**: note changes under `[Unreleased]` in `CHANGELOG.md`; a release sets the version in
  `package.json` and `src/version.ts`, which a test matches against the latest changelog version.
