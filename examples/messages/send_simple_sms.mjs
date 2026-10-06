/**
 * Send a simple SMS message.
 *
 *   CALISERO_API_KEY=... CALISERO_TEST_PHONE=+40742123456 node examples/messages/send_simple_sms.mjs
 */

import { ApiError, SmsClient, ValidationError } from '@calisero/calisero-node';

// Your API key, from the dashboard's API Keys section
const apiKey = process.env.CALISERO_API_KEY ?? 'your-api-key-here';
const recipient = process.env.CALISERO_TEST_PHONE ?? '+40742***350';

try {
    console.log('=== Send Simple SMS ===\n');

    const response = await SmsClient.create(apiKey).messages.create({
        recipient,
        body: 'Hello from Calisero! This is a simple test message.',
    });

    const message = response.data;

    console.log('✅ Message sent successfully!');
    console.log(`📨 Message ID: ${message.id}`);
    console.log(`📱 Recipient: ${message.recipient}`);
    console.log(`💬 Body: ${message.body}`);
    console.log(`📊 Status: ${message.status}`);
    console.log(`🧩 Parts: ${message.parts}`);
    console.log(`⏰ Created: ${message.createdAt}`);
    console.log(`🆔 Trace ID: ${response.responseMeta.traceId ?? 'N/A'}`);
} catch (error) {
    if (error instanceof ValidationError) {
        console.log(`❌ Validation error: ${error.message}`);

        for (const [field, messages] of Object.entries(error.validationErrors)) {
            console.log(`  - ${field}: ${messages.join(', ')}`);
        }
    } else if (error instanceof ApiError) {
        console.log(`❌ API error: ${error.message}`);
        console.log(`🔢 Status Code: ${error.statusCode ?? 'N/A'}`);
        console.log(`🆔 Trace ID: ${error.traceId ?? 'N/A'}`);
    } else {
        throw error;
    }
}
