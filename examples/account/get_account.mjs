/**
 * Retrieve the account: details, credit, status and daily sending limit.
 *
 *   CALISERO_API_KEY=... CALISERO_ACCOUNT_ID=... node examples/account/get_account.mjs
 */

import { ApiError, NotFoundError, SmsClient, UnauthorizedError } from '@calisero/calisero-node';

const apiKey = process.env.CALISERO_API_KEY ?? 'your-api-key-here';
// The account's ID, shown in the dashboard
const accountId = process.argv[2] ?? process.env.CALISERO_ACCOUNT_ID ?? '9d0e0bd3-c805-4dd0-bafb-07c5ded0a8e1';

try {
    console.log('=== Get Account Information ===\n');

    const { data: account } = await SmsClient.create(apiKey).accounts.get(accountId);

    console.log('✅ Account information retrieved successfully!\n');

    console.log('📋 Basic Information:');
    console.log(`  🆔 Account ID: ${account.id}`);
    console.log(`  🏷️ Account Code: ${account.code}`);
    console.log(`  👤 Name: ${account.name}`);
    console.log(`  📝 Description: ${account.description ?? 'Not provided'}`);
    console.log(`  📧 Email: ${account.email ?? 'Not provided'}`);
    console.log(`  📞 Phone: ${account.phone ?? 'Not provided'}`);
    console.log(`  👨‍💼 Contact Person: ${account.contactPerson ?? 'Not provided'}\n`);

    console.log('💰 Financial Information:');
    console.log(`  💳 Current Credit: ${account.credit}`);
    console.log(`  🏦 IBAN: ${account.iban ?? 'Not provided'}`);
    console.log(`  📄 Fiscal Code: ${account.fiscalCode ?? 'Not provided'}`);
    console.log(`  📋 Registry Number: ${account.registryNumber ?? 'Not provided'}\n`);

    console.log('📍 Address Information:');
    console.log(`  🏠 Address: ${account.address ?? 'Not provided'}`);
    console.log(`  🏙️ City: ${account.city ?? 'Not provided'}`);
    console.log(`  🗺️ State: ${account.state ?? 'Not provided'}`);
    console.log(`  🌍 Country: ${account.country ?? 'Not provided'}`);
    console.log(`  📮 Postal Code: ${account.postalCode ?? 'Not provided'}\n`);

    console.log('⚙️ Account Status:');
    console.log(`  📊 Status: ${account.status}`);
    console.log(`  🧪 Sandbox Mode: ${account.sandbox ? 'Yes' : 'No'}`);
    console.log(`  ⏰ Created: ${account.createdAt}\n`);

    console.log('📆 Daily Sending Limit:');
    console.log(`  📊 Daily Limit: ${account.dailyLimit ?? 'None'}`);
    console.log(`  📥 Left Today: ${account.dailyRemaining ?? 'Unlimited'}`);
    console.log(`  📤 Sent Today: ${account.sentToday}`);

    if (account.sandbox) {
        console.log('\n🧪 SANDBOX NOTICE:');
        console.log('  This account is in sandbox mode: its messages are test messages,');
        console.log('  marked delivered at once, never sent to a phone nor billed.');
    }
} catch (error) {
    if (error instanceof UnauthorizedError) {
        console.log(`❌ Authentication error: ${error.message}`);
        console.log("💡 Please check your API key and ensure it's valid");
    } else if (error instanceof NotFoundError) {
        console.log(`❌ Account not found: ${error.message}`);
        console.log(`💡 Please check if the account ID '${accountId}' is correct`);
    } else if (error instanceof ApiError) {
        console.log(`❌ API error: ${error.message}`);
        console.log(`🔢 Status Code: ${error.statusCode ?? 'N/A'}`);
        console.log(`🆔 Trace ID: ${error.traceId ?? 'N/A'}`);
    } else {
        throw error;
    }
}
