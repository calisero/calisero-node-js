/**
 * Retrieve a verification by its id.
 *
 *   CALISERO_API_KEY=... node examples/verifications/get_verification.mjs <verification-id>
 */

import { ApiError, NotFoundError, SmsClient } from '@calisero/calisero-node';

const apiKey = process.env.CALISERO_API_KEY ?? 'your-api-key-here';
const verificationId = process.argv[2] ?? '019a62f1-66b7-7387-a64f-2742c12a2860';

try {
    console.log('=== Get Verification ===\n');

    const { data: verification } = await SmsClient.create(apiKey).verifications.get(verificationId);

    console.log('✅ Verification retrieved successfully!');
    console.log(`🆔 ID: ${verification.id}`);
    console.log(`📱 Phone: ${verification.phone}`);
    console.log(`📊 Status: ${verification.status}`);
    console.log(`✅ Verified at: ${verification.verifiedAt ?? 'Not verified yet'}`);
    console.log(`⏰ Expires at: ${verification.expiresAt}`);
    console.log(`🧪 Attempts: ${verification.attempts}`);
    console.log(`⌛ Expired: ${verification.expired ? 'Yes' : 'No'}`);
} catch (error) {
    if (error instanceof NotFoundError) {
        console.log(`❌ Verification not found: ${error.message}`);
        console.log(`💡 Please check if the verification ID '${verificationId}' is correct`);
    } else if (error instanceof ApiError) {
        console.log(`❌ API error: ${error.message}`);
        console.log(`🔢 Status Code: ${error.statusCode ?? 'N/A'}`);
        console.log(`🆔 Trace ID: ${error.traceId ?? 'N/A'}`);
    } else {
        throw error;
    }
}
