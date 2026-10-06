/**
 * Check the code a user received against the latest verification of their phone.
 *
 *   CALISERO_API_KEY=... CALISERO_TEST_PHONE=+40742123456 node examples/verifications/validate_verification.mjs <code>
 */

import { ApiError, NotFoundError, SmsClient, ValidationError } from '@calisero/calisero-node';

const apiKey = process.env.CALISERO_API_KEY ?? 'your-api-key-here';
const phone = process.env.CALISERO_TEST_PHONE ?? '+40742***350';
const code = process.argv[2] ?? 'ABC123'; // the 6-character code, in any case

try {
    console.log('=== Validate Verification (OTP) ===\n');

    const { data: verification } = await SmsClient.create(apiKey).verifications.validate({ phone, code });

    console.log('✅ Verification validated successfully!');
    console.log(`📱 Phone: ${verification.phone}`);
    console.log(`📊 Status: ${verification.status}`);
    console.log(`✅ Verified at: ${verification.verifiedAt ?? 'Just verified / already verified'}`);
    console.log(`🧪 Attempts used: ${verification.attempts}`);
} catch (error) {
    if (error instanceof ValidationError) {
        // A wrong code, an expired one, or too many attempts (5)
        console.log(`❌ Validation failed: ${error.message}`);

        for (const [field, messages] of Object.entries(error.validationErrors)) {
            console.log(`  - ${field}: ${messages.join(', ')}`);
        }
    } else if (error instanceof NotFoundError) {
        console.log(`❌ No verification was started for ${phone}`);
    } else if (error instanceof ApiError) {
        console.log(`❌ API error: ${error.message}`);
        console.log(`🔢 Status Code: ${error.statusCode ?? 'N/A'}`);
        console.log(`🆔 Trace ID: ${error.traceId ?? 'N/A'}`);
    } else {
        throw error;
    }
}
