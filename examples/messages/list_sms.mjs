/**
 * List the messages, newest first, 50 a page.
 *
 *   CALISERO_API_KEY=... node examples/messages/list_sms.mjs [page]
 */

import { ApiError, SmsClient } from '@calisero/calisero-node';

const apiKey = process.env.CALISERO_API_KEY ?? 'your-api-key-here';
const page = Number(process.argv[2] ?? 1);

try {
    console.log('=== List SMS Messages ===\n');

    const client = SmsClient.create(apiKey);
    const response = await client.messages.list({ page });
    const { data: messages, meta, links } = response;

    console.log('✅ Messages listed successfully!');
    console.log(`📊 Messages on this page: ${messages.length}`);
    console.log(`📄 Current page: ${meta.currentPage}`);
    console.log(`📄 Per page: ${meta.perPage}`);
    console.log(`📄 From record: ${meta.from ?? 'N/A'}`);
    console.log(`📄 To record: ${meta.to ?? 'N/A'}\n`);

    if (messages.length > 0) {
        console.log('📝 Recent messages:');

        for (const [index, message] of messages.slice(0, 5).entries()) {
            const body = message.body.length > 30 ? `${message.body.slice(0, 30)}...` : message.body;
            console.log(`  ${index + 1}. 📨 ${message.id} -> ${message.recipient}: ${body} [${message.status}]`);
        }

        if (messages.length > 5) {
            console.log(`  ... and ${messages.length - 5} more messages`);
        }
    } else {
        console.log('📭 No messages found');
    }

    console.log('\n🔗 Pagination:');
    console.log(`  - Previous page: ${links.prev ? 'Available' : 'N/A'}`);
    console.log(`  - Next page: ${links.next ? 'Available' : 'N/A'}`);

    if (response.hasNextPage) {
        console.log('\n📄 Getting next page...');
        const next = await client.messages.list({ page: meta.currentPage + 1 });
        console.log(`✅ Next page retrieved with ${next.data.length} messages`);
    }
} catch (error) {
    if (error instanceof ApiError) {
        console.log(`❌ API error: ${error.message}`);
        console.log(`🔢 Status Code: ${error.statusCode ?? 'N/A'}`);
        console.log(`🆔 Trace ID: ${error.traceId ?? 'N/A'}`);
    } else {
        throw error;
    }
}
