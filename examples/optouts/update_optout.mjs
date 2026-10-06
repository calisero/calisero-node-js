/**
 * Update the reason of an opt-out.
 *
 *   CALISERO_API_KEY=... node examples/optouts/update_optout.mjs <opt-out-id>
 */

import { ApiError, NotFoundError, SmsClient, ValidationError } from '@calisero/calisero-node';

const apiKey = process.env.CALISERO_API_KEY ?? 'your-api-key-here';
const optOutId = process.argv[2] ?? '019999b5-5687-71cd-ae81-baf6eea9d86f';

const client = SmsClient.create(apiKey);

try {
    console.log('=== Update OptOut ===\n');

    console.log('1️⃣ Checking current opt-out status...');
    const { data: current } = await client.optOuts.get(optOutId);

    console.log('✅ Current opt-out found:');
    console.log(`   📱 Phone: ${current.phone}`);
    console.log(`   📝 Current reason: ${current.reason ?? 'Not specified'}`);
    console.log(`   ⏰ Created: ${current.createdAt}`);
    console.log(`   🔄 Last updated: ${current.updatedAt}\n`);

    console.log('2️⃣ Updating opt-out reason...');
    const { data: updated } = await client.optOuts.update(optOutId, {
        phone: current.phone,
        reason: 'Updated: Customer called support and confirmed they want to remain opted out',
    });

    console.log('✅ Opt-out updated successfully!');
    console.log(`🆔 OptOut ID: ${updated.id}`);
    console.log(`📱 Phone Number: ${updated.phone}`);
    console.log(`📝 Updated Reason: ${updated.reason}`);
    console.log(`🔄 Updated: ${updated.updatedAt}`);
} catch (error) {
    if (error instanceof NotFoundError) {
        console.log(`❌ No opt-out found for ${optOutId}`);
        console.log('💡 You need to create an opt-out first before updating it');
    } else if (error instanceof ValidationError) {
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
