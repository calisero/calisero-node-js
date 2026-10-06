/**
 * List the opt-outs, 50 a page.
 *
 *   CALISERO_API_KEY=... node examples/optouts/list_optouts.mjs [page]
 */

import { ApiError, SmsClient } from '@calisero/calisero-node';

const apiKey = process.env.CALISERO_API_KEY ?? 'your-api-key-here';
const page = Number(process.argv[2] ?? 1);

try {
    console.log('=== List OptOuts ===\n');

    const { data: optOuts, meta, links } = await SmsClient.create(apiKey).optOuts.list({ page });

    console.log('✅ OptOuts listed successfully!');
    console.log(`📊 OptOuts on this page: ${optOuts.length}`);
    console.log(`📄 Current page: ${meta.currentPage}`);
    console.log(`📄 Per page: ${meta.perPage}`);
    console.log(`📄 From record: ${meta.from ?? 'N/A'}`);
    console.log(`📄 To record: ${meta.to ?? 'N/A'}\n`);

    if (optOuts.length > 0) {
        console.log('🚫 Current opt-outs:');

        for (const [index, optOut] of optOuts.slice(0, 10).entries()) {
            const reason = optOut.reason
                ? optOut.reason.length > 40
                    ? `${optOut.reason.slice(0, 40)}...`
                    : optOut.reason
                : 'No reason provided';

            console.log(`  ${index + 1}. 📱 ${optOut.phone} [ID: ${optOut.id}]`);
            console.log(`     📝 ${reason}`);
            console.log(`     ⏰ ${optOut.createdAt}\n`);
        }

        if (optOuts.length > 10) {
            console.log(`  ... and ${optOuts.length - 10} more opt-outs\n`);
        }

        const withReasons = optOuts.filter((optOut) => optOut.reason !== null).length;
        console.log('📊 Statistics for this page:');
        console.log(`  - With reasons: ${withReasons}`);
        console.log(`  - Without reasons: ${optOuts.length - withReasons}`);
    } else {
        console.log('✅ No opt-outs found - all numbers can receive messages');
    }

    console.log('\n🔗 Pagination:');
    console.log(`  - Previous page: ${links.prev ? 'Available' : 'N/A'}`);
    console.log(`  - Next page: ${links.next ? `node examples/optouts/list_optouts.mjs ${page + 1}` : 'N/A'}`);
} catch (error) {
    if (error instanceof ApiError) {
        console.log(`❌ API error: ${error.message}`);
        console.log(`🔢 Status Code: ${error.statusCode ?? 'N/A'}`);
        console.log(`🆔 Trace ID: ${error.traceId ?? 'N/A'}`);
    } else {
        throw error;
    }
}
