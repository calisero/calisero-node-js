/**
 * List the verifications, newest first, optionally only the verified or the
 * unverified ones.
 *
 *   CALISERO_API_KEY=... node examples/verifications/list_verifications.mjs [page] [verified|unverified]
 */

import { ApiError, SmsClient } from '@calisero/calisero-node';

const apiKey = process.env.CALISERO_API_KEY ?? 'your-api-key-here';
const page = Number(process.argv[2] ?? 1);
const status = process.argv[3] ?? null;

try {
    console.log('=== List Verifications ===\n');

    const { data: verifications, meta, links } = await SmsClient.create(apiKey).verifications.list({ page, status });

    console.log('✅ Verifications listed successfully!');
    console.log(`📊 Total on page: ${verifications.length}`);
    console.log(`📄 Current page: ${meta.currentPage}`);
    console.log(`📄 Per page: ${meta.perPage}`);
    console.log(`📄 From record: ${meta.from ?? 'N/A'}`);
    console.log(`📄 To record: ${meta.to ?? 'N/A'}\n`);

    if (verifications.length > 0) {
        console.log('📝 Recent verifications:');

        for (const [index, verification] of verifications.slice(0, 5).entries()) {
            console.log(
                `  ${index + 1}. ✅ ${verification.id} | ${verification.phone} | ${verification.status}` +
                    ` | attempts: ${verification.attempts} | expired: ${verification.expired ? 'yes' : 'no'}`,
            );
        }

        if (verifications.length > 5) {
            console.log(`  ... and ${verifications.length - 5} more verifications`);
        }
    } else {
        console.log('📭 No verifications found');
    }

    if (links.next) {
        console.log(`\n💡 Tip: run it with the page ${meta.currentPage + 1} to fetch the next page.`);
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
