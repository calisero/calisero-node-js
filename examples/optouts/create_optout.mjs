/**
 * Opt a phone number out: the API then refuses to send it messages.
 *
 *   CALISERO_API_KEY=... CALISERO_TEST_PHONE=+40742123456 node examples/optouts/create_optout.mjs
 */

import { ApiError, SmsClient, ValidationError } from '@calisero/calisero-node';

const apiKey = process.env.CALISERO_API_KEY ?? 'your-api-key-here';
const phone = process.env.CALISERO_TEST_PHONE ?? '+40742***350';

try {
    console.log('=== Create OptOut ===\n');

    const { data: optOut } = await SmsClient.create(apiKey).optOuts.create({
        phone,
        reason: 'Customer requested to stop receiving marketing messages',
    });

    console.log('✅ Opt-out created successfully!');
    console.log(`🆔 OptOut ID: ${optOut.id}`);
    console.log(`📱 Phone Number: ${optOut.phone}`);
    console.log(`📝 Reason: ${optOut.reason ?? 'Not specified'}`);
    console.log(`⏰ Created: ${optOut.createdAt}`);
    console.log(`🔄 Updated: ${optOut.updatedAt}`);
    console.log('\n💡 This phone number will no longer receive SMS messages');
} catch (error) {
    if (error instanceof ValidationError) {
        // e.g. a number already opted out
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
