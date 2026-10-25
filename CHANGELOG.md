# Changelog

All notable changes to `@calisero/calisero-node` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.2] - 2026-10-25

Support for version 1.0.15 of the Calisero API. The API added validation rules but no field or endpoint, so the library's code and API are unchanged; only the version in the `User-Agent` header moves to 1.0.2.

### Changed
- `resources/openApi/api-v1.json` updated to the API's 1.0.15 document. The contract tests check the library against it: they read the delivery webhook where the document now describes it, as the `deliveryStatus` callback of `POST /messages`, and the new example answer of `PUT /opt-outs/{id}`.

### Documentation
- `AGENTS.md`: guidance for AI coding agents, both for integrating Calisero into an application with this library (configuration, sending, OTP, statuses, the delivery webhook, errors and trace IDs, sandbox keys, the pitfalls of the API) and for working on the library. It ships in the npm package (`files` in `package.json`).
- The validation rules of API 1.0.15, in `README.md` and in the type declarations of the requests (shown by editors):
  - `callbackUrl` must be an http or https address on the public Internet: private, loopback and link-local addresses are refused, and redirects are not followed. The webhook section explains how to receive callbacks on a development machine.
  - `sender` must be a sender approved for the account, written exactly as approved; any other is refused with a `ValidationError` ("The sender is invalid or is not approved.") and nothing is sent.
  - The `brand` and the `template` of a verification may not contain links (web addresses, domains, emails or IP addresses).

## [1.0.1] - 2026-10-06

The first version published to npm: the publish job of 1.0.0 failed, so 1.0.0 exists only as a GitHub release. The library's code and API are unchanged; only the version in the `User-Agent` header moves to 1.0.1.

### Fixed
- **Publishing to npm.** The `repository`, `homepage` and `bugs` fields of `package.json` named `calisero/calisero-node` instead of the library's repository, `calisero/calisero-node-js`. npm publishes with provenance only a package whose `repository.url` matches the repository the publish workflow runs in. They now name `calisero/calisero-node-js`.
- `README.md`: the CI and coverage badges, the `git clone` command and the issues link pointed to the same wrong repository; so did the `git clone` command of `CONTRIBUTING.md`.

### Documentation
- `CONTRIBUTING.md`: a new "Publishing Setup" section. The first version goes out with a granular access token saved as the `NPM_TOKEN` secret; then npm's trusted publishing (OIDC) for the `ci.yml` workflow of `calisero/calisero-node-js` replaces the token.

## [1.0.0] - 2026-10-05

First release of the official Node.js library for the Calisero SMS API, covering version 1.0.14 of the API: the same API surface as `calisero/calisero-php` 2.3.0, with a Promise-based, fully typed interface.

### Added
- **`SmsClient`** with `SmsClient.create(apiKey, options)`: `baseUrl`, `timeout` (30 s by default), a custom `fetch` (e.g. undici with a proxy agent) or a `transport` of your own. `new SmsClient(httpClient)` builds the client on an `HttpClient` you configured yourself.
- **Messages** (`client.messages`): `create()`, `get()`, `list({ page })` and `delete()`. `create()` accepts every option of the API, `scheduleAt` included as a `Date`, converted to the `YYYY-MM-DD HH:MM:SS` Romania time the API expects (summer and winter time handled).
- **URL shortening**: `shortenUrls: true` and `Message.shortenedUrls`, each `ShortenedLink` with its click statistics.
- **Opt-outs** (`client.optOuts`): `create()`, `get()`, `list({ page })`, `update()` and `delete()`.
- **Verifications (OTP)** (`client.verifications`): `create()`, `get()`, `list({ page, status })` and `validate()`.
- **Accounts** (`client.accounts`): `get()`, with the credit, the status and the daily sending limit (`dailyLimit`, `dailyRemaining`, `sentToday`).
- **Response metadata**: every response carries a `ResponseMeta` (`responseMeta`) read from the answer's headers: the trace ID, the request rate limit and, for a created message or verification, what is left of the daily sending limit.
- **Errors**: `ApiError` and its subclasses `UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ValidationError` (422, with `validationErrors`), `RateLimitedError` (429, request rate limit), `DailyLimitExceededError` (429, daily sending limit, extends `RateLimitedError`), `ServerError` (5xx) and `TransportError` (no answer: network error, timeout, abort). Each carries the API's message, the HTTP status, the trace ID and the decoded error body.
- **Delivery status webhooks**: `DeliveryWebhookMessage.fromJson()` and `fromObject()` read and validate the callback payload, and `createDeliveryWebhookHandler()` answers the callbacks for `node:http` and Express, with an optional secret `token` checked in constant time.
- **User-Agent**: every request names the library, its version and the runtime, e.g. `Calisero-SMS-Node/1.0.0 (Node.js v24.21.0; linux x64)`, so the platform can tell its requests apart. The new `appInfo` option (`{ name, version }`) appends your application, e.g. `MyShop/2.1.0`; `client.httpClient.userAgent` shows the header sent.
- **Cancellation**: every call takes an `AbortSignal` (`{ signal }`).
- **Zero runtime dependencies**: the HTTP layer is the `fetch` built into Node.js.
- **TypeScript**: written in strict TypeScript; the type declarations ship with the package.
- **ES module** that CommonJS code can `require()` (Node.js 20.19+, 22.12+).
- Examples for every operation in `examples/`.
- Tests: unit tests, integration tests against a local HTTP server, contract tests against the API's OpenAPI document, webhook handler tests over real HTTP, and smoke tests of the built package from ESM and CommonJS. CI runs them on Node.js 20, 22, 24 and 26.

### Notes
- The library sends no `Idempotency-Key` header and never retries a request: the API takes no idempotency key, so a create retried after a timeout or a server error could send the message twice. The API refuses (422, `duplicate_sms`) the same message to the same recipient sent again within 5 seconds.
- Vitest stays on 4.x while Node.js 20 is supported: Vitest 5 requires Node.js 22.12 or later.
