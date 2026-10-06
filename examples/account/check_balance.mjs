/**
 * Check the credit and the daily sending limit before a campaign.
 *
 *   CALISERO_API_KEY=... CALISERO_ACCOUNT_ID=... node examples/account/check_balance.mjs
 */

import { ApiError, NotFoundError, SmsClient, UnauthorizedError } from '@calisero/calisero-node';

const apiKey = process.env.CALISERO_API_KEY ?? 'your-api-key-here';
const accountId = process.argv[2] ?? process.env.CALISERO_ACCOUNT_ID ?? '9d0e0bd3-c805-4dd0-bafb-07c5ded0a8e1';

// An average price of an SMS part, to estimate what the credit covers: use your own pricing
const averageCostPerSms = 0.05;

try {
    console.log('=== Account Balance Check ===\n');

    const { data: account } = await SmsClient.create(apiKey).accounts.get(accountId);
    const { credit, dailyLimit, dailyRemaining } = account;

    console.log('💰 Account Balance Information');
    console.log(`📋 Account: ${account.name} (ID: ${account.id})`);
    console.log(`💳 Current Credit: ${credit}`);
    console.log(`📊 Account Status: ${account.status}`);
    console.log(`🧪 Environment: ${account.sandbox ? 'Sandbox' : 'Production'}\n`);

    console.log('📈 Balance Analysis:');

    if (credit > 100) {
        console.log('  🟢 Status: EXCELLENT - healthy for regular SMS operations');
    } else if (credit > 50) {
        console.log('  🟡 Status: GOOD - consider topping up for high-volume campaigns');
    } else if (credit > 10) {
        console.log('  🟠 Status: LOW - top up your account soon');
    } else {
        console.log('  🔴 Status: CRITICAL - top up immediately to maintain service');
    }

    const estimatedMessages = Math.floor(credit / averageCostPerSms);

    console.log('\n📱 Estimated Message Capacity:');
    console.log(`  💸 Estimated cost per SMS: ${averageCostPerSms}`);
    console.log(`  📊 Approximate messages remaining: ~${estimatedMessages}`);

    console.log('\n📆 Daily Sending Limit:');

    if (dailyLimit === null) {
        console.log('  ✅ No daily limit applies to this account');
    } else {
        console.log(`  📊 Limit: ${dailyLimit} messages a day (resets at midnight, Romania time)`);
        console.log(`  📤 Sent today: ${account.sentToday}`);
        console.log(`  📥 Left today: ${dailyRemaining}`);

        if (dailyRemaining === 0) {
            console.log('  🔴 The limit is reached: new messages are refused until midnight');
        } else if (dailyRemaining !== null && dailyRemaining < dailyLimit * 0.2) {
            console.log('  🟠 Less than 20% of the limit is left for today');
        }

        if (dailyRemaining !== null && dailyRemaining < estimatedMessages) {
            console.log('  💡 The daily limit, not the credit, caps what you can send today');
        }
    }

    console.log('\n🔍 Service Readiness Check:');
    const issues = [];

    if (credit <= 0) {
        issues.push('Insufficient credit balance');
    }

    if (dailyRemaining === 0) {
        issues.push('Daily sending limit reached until midnight, Romania time');
    }

    if (account.status !== 'active') {
        issues.push(`Account status is ${account.status}, not active`);
    }

    if (issues.length === 0) {
        console.log('  ✅ All systems ready for SMS operations');
    } else {
        console.log('  ❌ Issues detected:');

        for (const issue of issues) {
            console.log(`    - ${issue}`);
        }
    }
} catch (error) {
    if (error instanceof UnauthorizedError) {
        console.log(`❌ Authentication error: ${error.message}`);
        console.log('💡 Please verify your API key is valid and not expired');
    } else if (error instanceof NotFoundError) {
        console.log(`❌ Account not found: ${error.message}`);
        console.log(`💡 Please verify the account ID '${accountId}' is correct`);
    } else if (error instanceof ApiError) {
        console.log(`❌ API error: ${error.message}`);
        console.log(`🔢 Status Code: ${error.statusCode ?? 'N/A'}`);
        console.log(`🆔 Trace ID: ${error.traceId ?? 'N/A'}`);
    } else {
        throw error;
    }
}
