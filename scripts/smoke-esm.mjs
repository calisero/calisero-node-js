/**
 * Imports the built package by its name, as an application does (`import`), and
 * sends a message through a stub transport. Run after `npm run build`.
 */

import assert from 'node:assert/strict';
import * as sdk from '@calisero/calisero-node';

const expectedExports = [
    'SmsClient',
    'VERSION',
    'HttpClient',
    'FetchTransport',
    'HttpResponse',
    'BearerTokenAuthProvider',
    'MessageService',
    'OptOutService',
    'AccountService',
    'VerificationService',
    'Message',
    'ShortenedLink',
    'OptOut',
    'Account',
    'Verification',
    'Paginated',
    'ResponseMeta',
    'ApiResponse',
    'DeliveryWebhookMessage',
    'createDeliveryWebhookHandler',
    'ApiError',
    'UnauthorizedError',
    'ForbiddenError',
    'NotFoundError',
    'ValidationError',
    'RateLimitedError',
    'DailyLimitExceededError',
    'ServerError',
    'TransportError',
    'InvalidWebhookPayloadError',
];

for (const name of expectedExports) {
    assert.ok(name in sdk, `the package does not export ${name}`);
}

const message = {
    id: '9e2574e8-3615-4090-9b5a-0fc812079da8',
    recipient: '+40742123456',
    body: 'Smoke test',
    parts: 1,
    created_at: '2026-10-05T10:00:00.000000Z',
    status: 'scheduled',
};
const client = sdk.SmsClient.create('smoke-test-key', {
    transport: {
        send: async (request) => {
            assert.equal(
                request.headers['User-Agent'],
                `Calisero-SMS-Node/${sdk.VERSION} (Node.js ${process.version}; ${process.platform} ${process.arch})`,
            );

            return new sdk.HttpResponse(201, { 'X-Trace-Id': 'smoke' }, JSON.stringify({ data: message }));
        },
    },
});
const response = await client.messages.create({ recipient: message.recipient, body: message.body });

assert.ok(response.data instanceof sdk.Message);
assert.equal(response.data.id, message.id);
assert.equal(response.responseMeta.traceId, 'smoke');
assert.ok(new sdk.DailyLimitExceededError() instanceof sdk.RateLimitedError);

console.log(`✅ import of @calisero/calisero-node ${sdk.VERSION} works (Node.js ${process.version})`);
