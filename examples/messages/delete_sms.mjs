/**
 * Cancel a scheduled message: schedule one for tomorrow, then delete it.
 *
 *   CALISERO_API_KEY=... CALISERO_TEST_PHONE=+40742123456 node examples/messages/delete_sms.mjs
 */

import { ApiError, ForbiddenError, NotFoundError, SmsClient } from '@calisero/calisero-node';

const apiKey = process.env.CALISERO_API_KEY ?? 'your-api-key-here';
const recipient = process.env.CALISERO_TEST_PHONE ?? '+40742***350';

const client = SmsClient.create(apiKey);

try {
    console.log('=== Delete SMS Message ===\n');

    console.log('1️⃣ Creating a scheduled message for deletion demo...');
    const { data: message } = await client.messages.create({
        recipient,
        body: 'This message will be deleted before sending.',
        scheduleAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
    });

    console.log('✅ Scheduled message created!');
    console.log(`📨 Message ID: ${message.id}`);
    console.log(`📅 Scheduled for: ${message.scheduledAt}`);
    console.log(`📊 Status: ${message.status}\n`);

    console.log('2️⃣ Deleting the scheduled message...');
    await client.messages.delete(message.id);

    console.log('✅ Message deleted successfully!');
    console.log(`💡 The message '${message.id}' has been cancelled and will not be sent`);

    console.log('\n3️⃣ Verifying deletion...');

    try {
        await client.messages.get(message.id);
        console.log('⚠️ Message still exists');
    } catch (error) {
        if (!(error instanceof NotFoundError)) {
            throw error;
        }

        console.log('✅ Confirmed: a cancelled message is no longer found');
    }
} catch (error) {
    if (error instanceof ForbiddenError) {
        console.log(`❌ Cannot delete message: ${error.message}`);
        console.log('💡 Only scheduled messages that have not been sent can be deleted');
        console.log('💡 Messages already queued, sent or delivered cannot be deleted');
    } else if (error instanceof NotFoundError) {
        console.log(`❌ Message not found: ${error.message}`);
        console.log("💡 The message may have already been deleted or doesn't exist");
    } else if (error instanceof ApiError) {
        console.log(`❌ API error: ${error.message}`);
        console.log(`🔢 Status Code: ${error.statusCode ?? 'N/A'}`);
        console.log(`🆔 Trace ID: ${error.traceId ?? 'N/A'}`);
    } else {
        throw error;
    }
}
