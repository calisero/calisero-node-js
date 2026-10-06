/**
 * Receive delivery status callbacks.
 *
 * Calisero posts a JSON payload to a message's callback URL each time its status
 * changes (sent, delivered or undelivered). Answer with any 2xx status within
 * 2 seconds: only a failed connection or a slower answer is retried, at most
 * 5 attempts in total; a non-2xx answer is not retried.
 *
 * Calisero does not sign its callbacks: add a secret token to the callback URL
 * you send (https://yourapp.com/webhooks/calisero?token=...) and set it here as
 * CALISERO_WEBHOOK_TOKEN, so that only your callback URLs are accepted.
 *
 *   CALISERO_WEBHOOK_TOKEN=s3cr3t node examples/webhooks/delivery_webhook.mjs
 *
 *   curl -X POST 'http://localhost:8080/webhooks/calisero?token=s3cr3t' -H 'Content-Type: application/json' \
 *        -d '{"messageId":"019961db-14a7-7348-963f-5a7a789a969f","recipient":"+40742***350","status":"delivered","price":0.0378}'
 */

import { createServer } from 'node:http';
import { createDeliveryWebhookHandler } from '@calisero/calisero-node';

const port = Number(process.env.PORT ?? 8080);

const handler = createDeliveryWebhookHandler({
    token: process.env.CALISERO_WEBHOOK_TOKEN || undefined,

    // Keep the work here short (update a record, queue a job): the answer waits for it
    onMessage: (message) => {
        let line;

        switch (message.status) {
            case 'delivered':
                line = `📬 Message ${message.messageId} delivered to ${message.recipient} at ${message.deliveredAt}`;
                break;
            case 'undelivered':
                line = `❌ Message ${message.messageId} could not be delivered to ${message.recipient}`;
                break;
            default:
                line = `📤 Message ${message.messageId} sent to ${message.recipient} at ${message.sentAt}`;
        }

        line += ` | price: ${message.price.toFixed(4)} | balance: ${message.remainingBalance ?? 'N/A'}`;

        // The account's daily sending limit as it stood when the callback was sent
        if (message.dailyLimit !== null) {
            line += ` | daily limit: ${message.dailyRemaining} of ${message.dailyLimit} messages left today`;
        }

        console.log(line);
    },

    // A refused callback (bad token, malformed payload) or a failed onMessage
    onError: (error) => console.error('⚠️', error instanceof Error ? error.message : error),
});

createServer(handler).listen(port, () => {
    console.log(`👂 Listening for delivery status callbacks on http://localhost:${port}/webhooks/calisero`);
});
