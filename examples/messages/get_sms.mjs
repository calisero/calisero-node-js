/**
 * Retrieve a message and its delivery status.
 *
 *   CALISERO_API_KEY=... node examples/messages/get_sms.mjs <message-id>
 */

import { ApiError, NotFoundError, SmsClient } from '@calisero/calisero-node';

const apiKey = process.env.CALISERO_API_KEY ?? 'your-api-key-here';
const messageId = process.argv[2] ?? '9e2574e8-3615-4090-9b5a-0fc812079da8';

try {
    console.log('=== Get SMS Message ===\n');

    const { data: message } = await SmsClient.create(apiKey).messages.get(messageId);

    console.log('✅ Message retrieved successfully!');
    console.log(`📨 Message ID: ${message.id}`);
    console.log(`📱 Recipient: ${message.recipient}`);
    console.log(`💬 Body: ${message.body}`);
    console.log(`📊 Status: ${message.status}`);
    console.log(`🧩 Parts: ${message.parts}`);
    console.log(`⏰ Created: ${message.createdAt}`);
    console.log(`📅 Scheduled: ${message.scheduledAt ?? 'Sent immediately'}`);
    console.log(`📤 Sent: ${message.sentAt ?? 'Not sent yet'}`);
    console.log(`📥 Delivered: ${message.deliveredAt ?? 'Not delivered yet'}`);
    console.log(`🔗 Callback URL: ${message.callbackUrl ?? 'None'}`);
    console.log(`👤 Sender: ${message.sender ?? 'Default'}`);

    for (const link of message.shortenedUrls) {
        console.log(`✂️ ${link.shortenedLink}: ${link.clickCount} clicks, last ${link.lastClick ?? 'never'}`);
    }
} catch (error) {
    if (error instanceof NotFoundError) {
        console.log(`❌ Message not found: ${error.message}`);
        console.log(`💡 Please check if the message ID '${messageId}' exists`);
    } else if (error instanceof ApiError) {
        console.log(`❌ API error: ${error.message}`);
        console.log(`🔢 Status Code: ${error.statusCode ?? 'N/A'}`);
        console.log(`🆔 Trace ID: ${error.traceId ?? 'N/A'}`);
    } else {
        throw error;
    }
}
