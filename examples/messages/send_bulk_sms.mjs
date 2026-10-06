/**
 * Send the same message to several recipients, one request each, stopping once
 * the account's daily sending limit is used up.
 *
 *   CALISERO_API_KEY=... node examples/messages/send_bulk_sms.mjs
 */

import { setTimeout as sleep } from 'node:timers/promises';
import { ApiError, DailyLimitExceededError, SmsClient, ValidationError } from '@calisero/calisero-node';

const apiKey = process.env.CALISERO_API_KEY ?? 'your-api-key-here';

const recipients = ['+40742***350', '+40742***351', '+40742***352', '+40742***353', '+40742***354'];
const body =
    'Important announcement: Our office will be closed tomorrow for maintenance. Thank you for your understanding.';
const callbackUrl = 'https://yourapp.com/webhooks/bulk-sms';

// One client for all the requests
const client = SmsClient.create(apiKey);

/** @type {{ recipient: string, status: string, messageId?: string, parts?: number, error?: string }[]} */
const results = [];
let successCount = 0;
let failureCount = 0;

console.log('=== Send Bulk SMS Messages ===\n');
console.log(`📱 Sending messages to ${recipients.length} recipients...\n`);

for (const [index, recipient] of recipients.entries()) {
    try {
        process.stdout.write(`Sending to ${recipient}... `);

        const response = await client.messages.create({ recipient, body, validity: 24, callbackUrl });
        const message = response.data;

        console.log('✅ Success');
        console.log(`  📨 Message ID: ${message.id}`);
        console.log(`  📊 Status: ${message.status}`);

        // What is left of the account's daily sending limit (null when it has none)
        const { dailyRemaining } = response.responseMeta;

        if (dailyRemaining !== null) {
            console.log(`  📉 Daily limit: ${dailyRemaining} messages left today`);
        }

        console.log();
        results.push({ recipient, status: 'success', messageId: message.id, parts: message.parts });
        successCount++;

        // Every further message would be refused until midnight, Romania time
        if (dailyRemaining === 0) {
            console.log('⛔ Daily sending limit used up: the remaining recipients are skipped\n');
            break;
        }

        // Stay well under the request rate limit (240 requests a minute)
        if (index < recipients.length - 1) {
            await sleep(250);
        }
    } catch (error) {
        if (error instanceof DailyLimitExceededError) {
            // Nothing was sent or billed, and every further message would be refused too
            console.log('❌ Daily sending limit reached');
            console.log(`  💬 Error: ${error.message}\n`);
            results.push({ recipient, status: 'daily_limit_exceeded', error: error.message });
            failureCount++;
            break;
        }

        if (error instanceof ValidationError) {
            console.log('❌ Validation error');
            console.log(`  💬 Error: ${error.message}\n`);
            results.push({ recipient, status: 'validation_error', error: error.message });
            failureCount++;
            continue;
        }

        if (error instanceof ApiError) {
            console.log('❌ API error');
            console.log(`  💬 Error: ${error.message}`);
            console.log(`  🔢 Status: ${error.statusCode ?? 'N/A'}`);
            console.log(`  🆔 Trace ID: ${error.traceId ?? 'N/A'}\n`);
            results.push({ recipient, status: 'api_error', error: error.message });
            failureCount++;
            continue;
        }

        throw error;
    }
}

console.log('=== Bulk SMS Summary ===');
console.log(`✅ Successful: ${successCount}`);
console.log(`❌ Failed: ${failureCount}`);
console.log(`⏭️ Skipped: ${recipients.length - successCount - failureCount}`);
console.log(`📊 Total: ${recipients.length}`);
console.log(`📈 Success Rate: ${((successCount / recipients.length) * 100).toFixed(2)}%\n`);

console.log('📝 Detailed Results:');

for (const result of results) {
    const outcome =
        result.status === 'success'
            ? `✅ Sent (ID: ${result.messageId}, Parts: ${result.parts})`
            : `❌ ${result.status} - ${result.error}`;
    console.log(`  📱 ${result.recipient}: ${outcome}`);
}

if (successCount > 0) {
    console.log(`\n💡 Tip: Monitor the callback URL '${callbackUrl}' for delivery updates`);
}
