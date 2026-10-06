/**
 * Delete an opt-out: the number can receive messages again.
 *
 *   CALISERO_API_KEY=... node examples/optouts/delete_optout.mjs <opt-out-id>
 */

import { ApiError, NotFoundError, SmsClient } from '@calisero/calisero-node';

const apiKey = process.env.CALISERO_API_KEY ?? 'your-api-key-here';
const optOutId = process.argv[2] ?? '019999b5-5687-71cd-ae81-baf6eea9d86f';

const client = SmsClient.create(apiKey);

try {
    console.log('=== Delete OptOut ===\n');

    console.log('1️⃣ Checking current opt-out status...');
    const { data: optOut } = await client.optOuts.get(optOutId);

    console.log('✅ Opt-out found:');
    console.log(`   🆔 ID: ${optOut.id}`);
    console.log(`   📱 Phone: ${optOut.phone}`);
    console.log(`   📝 Reason: ${optOut.reason ?? 'Not specified'}\n`);

    console.log('2️⃣ Removing opt-out (re-enabling SMS delivery)...');
    await client.optOuts.delete(optOutId);

    console.log('✅ Opt-out deleted successfully!');
    console.log(`💡 ${optOut.phone} can now receive SMS messages again`);

    console.log('\n3️⃣ Verifying deletion...');

    try {
        await client.optOuts.get(optOutId);
        console.log('⚠️ Opt-out still exists');
    } catch (error) {
        if (!(error instanceof NotFoundError)) {
            throw error;
        }

        console.log('✅ Confirmed: Opt-out has been removed');
    }
} catch (error) {
    if (error instanceof NotFoundError) {
        console.log(`❌ No opt-out found with ID: ${optOutId}`);
        console.log('💡 The phone number may already be able to receive messages');
    } else if (error instanceof ApiError) {
        console.log(`❌ API error: ${error.message}`);
        console.log(`🔢 Status Code: ${error.statusCode ?? 'N/A'}`);
        console.log(`🆔 Trace ID: ${error.traceId ?? 'N/A'}`);
    } else {
        throw error;
    }
}
