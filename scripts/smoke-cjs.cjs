/**
 * Loads the built package by its name from CommonJS code (`require`), which
 * Node.js 20.19+ and 22.12+ allow for an ES module. Run after `npm run build`.
 */

const assert = require('node:assert/strict');
const { DeliveryWebhookMessage, SmsClient, VERSION, ValidationError, ApiError } = require('@calisero/calisero-node');

assert.equal(typeof SmsClient.create, 'function');
assert.equal(SmsClient.VERSION, VERSION);
assert.ok(new ValidationError('Invalid') instanceof ApiError);

const message = DeliveryWebhookMessage.fromJson(
    '{"messageId":"019961db-14a7-7348-963f-5a7a789a969f","recipient":"+40742123456","status":"delivered","price":0.0378}',
);

assert.equal(message.status, 'delivered');

console.log(`✅ require() of @calisero/calisero-node ${VERSION} works (Node.js ${process.version})`);
