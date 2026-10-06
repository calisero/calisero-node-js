/**
 * Start a verification: Calisero generates a 6-character code and sends it by SMS.
 *
 *   CALISERO_API_KEY=... CALISERO_TEST_PHONE=+40742123456 node examples/verifications/create_verification.mjs
 */

import { ApiError, DailyLimitExceededError, SmsClient, ValidationError } from '@calisero/calisero-node';

const apiKey = process.env.CALISERO_API_KEY ?? 'your-api-key-here';
const phone = process.env.CALISERO_TEST_PHONE ?? '+40742***350';

try {
    console.log('=== Create Verification (OTP) ===\n');

    const response = await SmsClient.create(apiKey).verifications.create({
        phone,
        // The brand named in the default message; or pass a `template` holding {code}
        brand: 'Calisero',
        expiresIn: 5, // minutes, 1 to 10
    });

    const verification = response.data;

    console.log('✅ Verification created successfully!');
    console.log(`🆔 ID: ${verification.id}`);
    console.log(`📱 Phone: ${verification.phone}`);
    console.log(`🏷️ Brand: ${verification.brand ?? 'N/A'}`);
    console.log(`📊 Status: ${verification.status}`);
    console.log(`⏰ Expires at: ${verification.expiresAt}`);
    console.log(`🧪 Attempts: ${verification.attempts}`);

    // The code's SMS counts towards the account's daily sending limit
    const { dailyRemaining } = response.responseMeta;

    if (dailyRemaining !== null) {
        console.log(`📊 Daily limit: ${dailyRemaining} messages left today`);
    }
} catch (error) {
    if (error instanceof DailyLimitExceededError) {
        console.log(`❌ Daily sending limit reached, no code was sent: ${error.message}`);
        console.log(`⏰ Sending resumes at: ${error.resetsAt ?? 'midnight, Romania time'}`);
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
