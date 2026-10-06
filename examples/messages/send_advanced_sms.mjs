/**
 * Send an SMS with every option: a body shown masked, a validity, a scheduled
 * time, a delivery status callback, a sender ID and URL shortening.
 *
 *   CALISERO_API_KEY=... CALISERO_TEST_PHONE=+40742123456 node examples/messages/send_advanced_sms.mjs
 */

import { ApiError, DailyLimitExceededError, SmsClient, ValidationError } from '@calisero/calisero-node';

const apiKey = process.env.CALISERO_API_KEY ?? 'your-api-key-here';
const recipient = process.env.CALISERO_TEST_PHONE ?? '+40742***350';

try {
    console.log('=== Send Advanced SMS ===\n');

    const response = await SmsClient.create(apiKey).messages.create({
        recipient,
        body: 'Your code is 123456. Manage alerts: https://yourapp.com/account/alerts',
        // What the API shows instead of the body in its answers and in the dashboard
        visibleBody: 'Your code is ******. Manage alerts: https://yourapp.com/account/alerts',
        validity: 24, // hours
        // A Date is converted to the Romania time the API expects
        scheduleAt: new Date(Date.now() + 60 * 60 * 1000),
        callbackUrl: 'https://yourapp.com/webhooks/sms',
        // One of your approved sender IDs; leave it out for the default sender
        sender: 'Calisero',
        shortenUrls: true,
    });

    const message = response.data;

    console.log('✅ Advanced message sent successfully!');
    console.log(`📨 Message ID: ${message.id}`);
    console.log(`📱 Recipient: ${message.recipient}`);
    console.log(`💬 Body: ${message.body}`);
    console.log(`📊 Status: ${message.status}`);
    console.log(`🧩 Parts: ${message.parts}`);
    console.log(`⏰ Created: ${message.createdAt}`);
    console.log(`📅 Scheduled: ${message.scheduledAt ?? 'Send immediately'}`);
    console.log(`🔗 Callback URL: ${message.callbackUrl ?? 'None'}`);
    console.log(`👤 Sender: ${message.sender ?? 'Default'}`);

    // The links of the body that were replaced by short ones
    console.log(`✂️ Shortened URLs: ${message.shortenedUrls.length > 0 ? message.shortenedUrls.length : 'None'}`);

    for (const link of message.shortenedUrls) {
        console.log(`  - ${link.shortenedLink} → ${link.originalLink}`);
    }

    // What the answer's headers report: trace ID and the account's daily sending limit
    const meta = response.responseMeta;
    console.log(`🆔 Trace ID: ${meta.traceId ?? 'N/A'}`);

    if (meta.dailyLimit !== null) {
        console.log(`📊 Daily limit: ${meta.dailyRemaining} of ${meta.dailyLimit} messages left today`);
    }
} catch (error) {
    if (error instanceof ValidationError) {
        console.log(`❌ Validation error: ${error.message}`);

        for (const [field, messages] of Object.entries(error.validationErrors)) {
            console.log(`  - ${field}: ${messages.join(', ')}`);
        }
    } else if (error instanceof DailyLimitExceededError) {
        console.log(`❌ Daily sending limit reached: ${error.message}`);
        console.log(`⏰ Sending resumes at: ${error.resetsAt ?? 'midnight, Romania time'}`);
    } else if (error instanceof ApiError) {
        console.log(`❌ API error: ${error.message}`);
        console.log(`🔢 Status Code: ${error.statusCode ?? 'N/A'}`);
        console.log(`🆔 Trace ID: ${error.traceId ?? 'N/A'}`);
    } else {
        throw error;
    }
}
