/**
 * Every error the library throws, and how to handle each.
 *
 *   CALISERO_API_KEY=... node examples/error_handling_complete.mjs
 */

import {
    ApiError,
    DailyLimitExceededError,
    ForbiddenError,
    NotFoundError,
    RateLimitedError,
    ServerError,
    SmsClient,
    TransportError,
    UnauthorizedError,
    ValidationError,
} from '@calisero/calisero-node';

const apiKey = process.env.CALISERO_API_KEY ?? 'your-api-key-here';
const TRACE_ID = '9b80eef1-49d4-4502-85a8-febb68cc11a7';

/**
 * Describe an error and what to do about it. Catch the most specific classes
 * first: DailyLimitExceededError extends RateLimitedError, and every class
 * extends ApiError.
 *
 * @param {unknown} error
 */
function handleSmsApiError(error) {
    if (!(error instanceof ApiError)) {
        console.log(`   🔧 Not an API error: ${error instanceof Error ? error.message : String(error)}`);

        return;
    }

    console.log(`   📝 Type: ${error.name}`);
    console.log(`   💬 Message: ${error.message}`);
    console.log(`   🔢 HTTP Status: ${error.statusCode ?? 'N/A'}`);
    console.log(`   🆔 Trace ID: ${error.traceId ?? 'N/A'}`);

    if (error instanceof UnauthorizedError) {
        console.log('   🔧 Action: Check the API key');
    } else if (error instanceof ValidationError) {
        console.log('   🔧 Action: Fix the request data');

        for (const [field, messages] of Object.entries(error.validationErrors)) {
            console.log(`     - ${field}: ${messages.join(', ')}`);
        }
    } else if (error instanceof NotFoundError) {
        console.log('   🔧 Action: Verify the resource exists and its ID is correct');
    } else if (error instanceof ForbiddenError) {
        console.log('   🔧 Action: Check the permissions, or whether the operation is still possible');
    } else if (error instanceof DailyLimitExceededError) {
        console.log(
            '   🔧 Action: Nothing was sent or billed: stop sending until the limit resets, or ask Calisero to raise it',
        );
        console.log(
            `   📊 Daily limit: ${error.dailyLimit ?? 'N/A'} messages, ${error.dailyRemaining ?? 'N/A'} left today`,
        );
        console.log(`   ⏰ Resets at: ${error.resetsAt ?? 'midnight, Romania time'}`);
    } else if (error instanceof RateLimitedError) {
        console.log(`   🔧 Action: Wait ${error.retryAfter ?? 1} seconds, then retry`);
        console.log(
            `   📊 Requests left this minute: ${error.rateLimitRemaining ?? 'N/A'} of ${error.rateLimitLimit ?? 'N/A'}`,
        );
    } else if (error instanceof ServerError) {
        console.log('   🔧 Action: Contact support with the trace ID if it persists');
        console.log('   ⚠️ Do not resend a message blindly: it may have been sent');
    } else if (error instanceof TransportError) {
        console.log(
            `   🔧 Action: Check the network (${error.cause instanceof Error ? error.cause.message : 'no answer'})`,
        );
        console.log('   ⚠️ Do not resend a message blindly: it may have been sent');
    } else {
        console.log('   🔧 Action: See the API documentation for this status');
    }
}

console.log('=== Comprehensive Error Handling Examples ===\n');

console.log('1️⃣ Authentication error (a real request with an invalid key)...');

try {
    await SmsClient.create('invalid-api-key').messages.create({ recipient: '+40742***350', body: 'Test message' });
} catch (error) {
    handleSmsApiError(error);
}

console.log('\n2️⃣ Validation error (a real request with an invalid recipient)...');

try {
    await SmsClient.create(apiKey).messages.create({ recipient: 'invalid-phone', body: '' });
} catch (error) {
    handleSmsApiError(error);
}

console.log('\n3️⃣ Not found error (a real request for a message that does not exist)...');

try {
    await SmsClient.create(apiKey).messages.get('00000000-0000-0000-0000-000000000000');
} catch (error) {
    handleSmsApiError(error);
}

console.log('\n4️⃣ Request rate limit (simulated)...');
handleSmsApiError(
    new RateLimitedError('Too Many Attempts.', {
        statusCode: 429,
        traceId: TRACE_ID,
        retryAfter: 17,
        rateLimitLimit: 240,
        rateLimitRemaining: 0,
        rateLimitReset: Math.floor(Date.now() / 1000) + 17,
    }),
);

console.log('\n5️⃣ Daily sending limit (simulated)...');
handleSmsApiError(
    new DailyLimitExceededError(
        'This account can send at most 1,000 messages a day. The limit resets at midnight, Romania time (2026-10-01T00:00:00+03:00). Contact us to raise it.',
        {
            statusCode: 429,
            traceId: TRACE_ID,
            errorDetails: { code: DailyLimitExceededError.ERROR_CODE },
            retryAfter: 21600,
            dailyLimit: 1000,
            dailyRemaining: 0,
            resetsAt: '2026-10-01T00:00:00+03:00',
        },
    ),
);

console.log('\n6️⃣ Server error (simulated)...');
handleSmsApiError(new ServerError('Server Error', { statusCode: 500, traceId: TRACE_ID }));

console.log('\n7️⃣ Transport error (a real request to a host that does not answer)...');

try {
    await SmsClient.create(apiKey, { baseUrl: 'http://127.0.0.1:9/api/v1', timeout: 2_000 }).messages.list();
} catch (error) {
    handleSmsApiError(error);
}

console.log('\n✨ Error handling examples completed!');
console.log('\n💡 Best Practices:');
console.log('  1. Catch the specific error classes first, then ApiError');
console.log('  2. Log trace IDs for support (Developers → Debug in the dashboard)');
console.log('  3. Wait Retry-After seconds on a RateLimitedError');
console.log('  4. Stop sending on a DailyLimitExceededError until it resets');
console.log('  5. Never retry a create after a timeout or a 5xx without checking: it may have been sent');
