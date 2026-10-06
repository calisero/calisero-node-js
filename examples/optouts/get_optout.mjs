/**
 * Retrieve an opt-out by its id.
 *
 *   CALISERO_API_KEY=... node examples/optouts/get_optout.mjs <opt-out-id>
 */

import { ApiError, NotFoundError, SmsClient } from '@calisero/calisero-node';

const apiKey = process.env.CALISERO_API_KEY ?? 'your-api-key-here';
const optOutId = process.argv[2] ?? '019999b5-5687-71cd-ae81-baf6eea9d86f';

try {
    console.log('=== Get OptOut ===\n');

    const { data: optOut } = await SmsClient.create(apiKey).optOuts.get(optOutId);

    console.log('✅ Opt-out found!');
    console.log(`🆔 OptOut ID: ${optOut.id}`);
    console.log(`📱 Phone Number: ${optOut.phone}`);
    console.log(`📝 Reason: ${optOut.reason ?? 'Not specified'}`);
    console.log(`⏰ Created: ${optOut.createdAt}`);
    console.log(`🔄 Last Updated: ${optOut.updatedAt}`);
    console.log('\n🚫 This phone number is currently opted out from receiving SMS messages');
} catch (error) {
    if (error instanceof NotFoundError) {
        console.log(`❌ No opt-out found with ID: ${optOutId}`);
        console.log('💡 Make sure the opt-out ID exists');
    } else if (error instanceof ApiError) {
        console.log(`❌ API error: ${error.message}`);
        console.log(`🔢 Status Code: ${error.statusCode ?? 'N/A'}`);
        console.log(`🆔 Trace ID: ${error.traceId ?? 'N/A'}`);
    } else {
        throw error;
    }
}
