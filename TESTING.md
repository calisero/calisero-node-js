# Testing

The library's tests live in `tests/` and run with [Vitest](https://vitest.dev). None of them reaches the network:
the services run against a stub transport, and the HTTP layer and the webhook handler against a local HTTP server
the tests start on `127.0.0.1`.

As of 1.0.2 the suite has **390 tests in 22 files** and covers 100% of the lines, statements, functions and branches
of `src/`. CI fails below the thresholds set in `vitest.config.ts` (98% of the lines, statements and functions, 95% of
the branches).

## Running the Tests

```bash
# All tests
npm test

# With a coverage report: text in the terminal, HTML in coverage/index.html
npm run test:coverage

# One file, or the tests whose names match a pattern
npx vitest run tests/unit/services/MessageService.test.ts
npx vitest run -t "daily limit"

# Re-run on every change
npm run test:watch

# Lint, types, tests, build, package smoke tests and examples, as CI runs them
npm run qa
```

## Supported Versions

CI runs the suite on Node.js 20, 22, 24 and 26 on Linux, and on Node.js 24 on macOS and Windows. Every version builds
the package and loads it by its name, with `import` and with `require()`.

- Vitest stays on 4.x while Node.js 20 is supported: Vitest 5 requires Node.js 22.12 or later.
- The library code may use only what Node.js 20.19 offers; `@types/node` stays on 20.x so the type check enforces it.

## Test Files

### Unit Tests (`tests/unit`)

| File | Tests | Covers |
|---|---|---|
| `SmsClient.test.ts` | 15 | `SmsClient.create()`: the services, independent clients, the default base URL, the API key (refused when empty), an auth provider read before each request, the `baseUrl`, `appInfo`, `fetch`, `timeout` and `transport` options; `new SmsClient(httpClient)` |
| `version.test.ts` | 4 | `VERSION` matches `package.json` and the latest version of CHANGELOG.md, and is named in the `User-Agent` |
| `errors.test.ts` | 16 | The error hierarchy, the names in stack traces, the properties of each error and their defaults, the `cause` |
| `requests.test.ts` | 17 | The request bodies: API field names, options left out when null, kept when `false` or `0`; `scheduleAt` as a `Date` in Romania time, summer and winter time and the switch between them; the required fields, checked by the compiler |

#### HTTP Layer (`tests/unit/http`)

| File | Tests | Covers |
|---|---|---|
| `HttpClient.test.ts` | 21 | The requests: method, URL, query string, headers, the User-Agent with and without your application, JSON body (UTF-8 included); the auth provider, sync or async, and its errors; the abort signal; no Idempotency-Key; the answers: JSON, empty, `[]`, not JSON; `lastResponse` |
| `userAgent.test.ts` | 10 | The User-Agent: the library and its version, then the runtime (Node.js, Bun, Deno, none), then your application, reduced to the characters a header allows so it cannot break the header |
| `HttpClientResponseHandling.test.ts` | 33 | Every error status mapped to its error class; the message and the trace ID (header in any case, body, `X-Request-ID`); error bodies that are not JSON; 422 field errors; the request rate limit's 429 against the daily sending limit's; requests that got no answer |
| `HttpResponse.test.ts` | 8 | Header names matched case-insensitively, as HTTP defines them; headers from a fetch `Headers`, an object or pairs |
| `FetchTransport.test.ts` | 14 | The fetch call (no redirect followed), the answer read, the timeout, the caller's abort, network errors, the options |

#### Resources (`tests/unit/dto`)

| File | Tests | Covers |
|---|---|---|
| `Message.test.ts` | 9 | Messages with every field, the minimal ones, shortened links; errors naming the field at fault, nested ones included |
| `Account.test.ts` | 6 | Full and minimal accounts (null address fields), the daily limit, credits as numbers or decimal strings |
| `OptOutAndVerification.test.ts` | 7 | Opt-outs with and without a reason; verifications unverified, verified, expired, sent with a template |
| `PaginationAndMeta.test.ts` | 10 | Pages, empty last pages, links and meta; `ResponseMeta` read from the headers, in any case, ignoring values that are not counts |
| `DeliveryWebhookMessage.test.ts` | 16 | Callback payloads from a string or a Buffer: full, minimal, without the daily limit, amounts as strings; refusing invalid JSON, `[]`, and every malformed required field |

#### Services (`tests/unit/services`)

Each test answers with a stub transport (`tests/support/StubTransport.ts`) and checks the request the service sends
(method, path, query, body) and what it reads from the answer, headers included.

| File | Tests | Covers |
|---|---|---|
| `MessageService.test.ts` | 21 | `create()` with every option, scheduled, with shortened links, its `responseMeta`, the daily limit and validation errors; `get()`, ids encoded, empty ids refused, unexpected answers; `list()` and its pages; `delete()` |
| `OptOutService.test.ts` | 10 | `create()` with and without a reason, a duplicate; `get()`, `list()`, `update()`, `delete()`; invalid arguments |
| `VerificationService.test.ts` | 13 | `list()` with the status filter; `create()` with a brand or a template, the daily limit; `get()`; `validate()` and each of its 422s, and its 404 |
| `AccountService.test.ts` | 5 | `get()` for a typical account, a sandbox one without a daily limit; 401 and 403 |
| `support.test.ts` | 5 | The services' helpers: reading answers, pages, ids and request objects |

#### Webhooks (`tests/unit/webhooks`)

| File | Tests | Covers |
|---|---|---|
| `createDeliveryWebhookHandler.test.ts` | 26 | Over real HTTP: the answers (200, 400, 401, 405, 413, 500), the token checked in constant time, Express body parsers (`json`, `raw`, `text`) and mounted routers, `onMessage` awaited before the answer, `onError`, the options |

### Integration Tests (`tests/integration`)

| File | Tests | Covers |
|---|---|---|
| `http.test.ts` | 12 | The SDK with its default fetch transport against a local server: headers (the User-Agent included) and UTF-8 bodies on the wire, answers and their headers, `[]` deletes, error mapping, HTML error pages, redirects not followed, timeouts, aborts, refused connections, and 20 concurrent requests each reading its own answer |

### Contract Tests (`tests/contract`)

| File | Tests | Covers |
|---|---|---|
| `openapi.test.ts` | 112 | The SDK against the API's OpenAPI document (`resources/openApi/api-v1.json`): every documented operation is implemented with its method, path and query; every documented example answer is read; every documented field of every resource is read; every documented request field can be sent, and nothing else; every documented error example maps to its error class with its message |

When the API changes, replace `resources/openApi/api-v1.json` with the new document: the contract tests then show
what the SDK lacks.

## Package Tests (`scripts/`)

Run after `npm run build`, by `npm run qa` and by CI on every Node.js version:

- `smoke-esm.mjs` imports the built package by its name and sends a message through a stub transport.
- `smoke-cjs.cjs` loads it with `require()`.
- `check-examples.mjs` checks the syntax of every example, then type-checks them against the built declarations
  (`tsconfig.examples.json`), so the examples cannot drift from the API.

CI also checks the published file list (`npm pack`), the type declarations
([Are The Types Wrong?](https://arethetypeswrong.github.io)) and the dependencies (`npm audit`, `npm audit signatures`).

## Writing Tests

- Build fixtures from what the API really sends: `tests/support/fixtures.ts` and the OpenAPI examples.
- Answer with `jsonResponse()` through a `StubTransport`, or with a local server (`tests/support/localServer.ts`) to
  test what goes over the wire.
- Cover the error paths as well as the successful ones: each error and the headers and body fields it reads.
- Run `npm run qa` before opening a pull request.
