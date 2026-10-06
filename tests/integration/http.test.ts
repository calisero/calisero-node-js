import { afterEach, describe, expect, it } from 'vitest';
import {
    ApiError,
    DailyLimitExceededError,
    ServerError,
    SmsClient,
    TransportError,
    ValidationError,
    VERSION,
} from '../../src/index.js';
import { DAILY_LIMIT_BODY, MESSAGE_ID, messageData, PHONE, pageOf, TRACE_ID } from '../support/fixtures.js';
import { type LocalServer, sendJson, startServer } from '../support/localServer.js';

/**
 * The SDK over real HTTP: the default fetch transport against a local server.
 */
let server: LocalServer | null = null;

afterEach(async () => {
    await server?.close();
    server = null;
});

function clientFor(url: string, timeout?: number): SmsClient {
    return SmsClient.create('integration-key', { baseUrl: `${url}/api/v1`, timeout });
}

describe('over HTTP', () => {
    it('sends an authenticated JSON request and reads the answer and its headers', async () => {
        server = await startServer((_request, response) => {
            sendJson(
                response,
                201,
                { data: messageData({ body: 'Bună ziua! Ștefan, țară, încă' }) },
                {
                    'X-Trace-Id': TRACE_ID,
                    'X-RateLimit-Limit': '240',
                    'X-RateLimit-Remaining': '239',
                    'X-Daily-Limit': '1000',
                    'X-Daily-Remaining': '999',
                },
            );
        });

        const response = await clientFor(server.url).messages.create({
            recipient: PHONE,
            body: 'Bună ziua! Ștefan, țară, încă',
            shortenUrls: false,
        });

        const [received] = server.received;
        expect(received?.method).toBe('POST');
        expect(received?.url).toBe('/api/v1/messages');
        expect(received?.headers).toMatchObject({
            accept: 'application/json',
            'content-type': 'application/json',
            authorization: 'Bearer integration-key',
            'user-agent': `Calisero-SMS-Node/${VERSION} (Node.js ${process.version}; ${process.platform} ${process.arch})`,
        });
        expect(JSON.parse(received?.body ?? '')).toEqual({
            recipient: PHONE,
            body: 'Bună ziua! Ștefan, țară, încă',
            shorten_urls: false,
        });
        expect(response.data.body).toBe('Bună ziua! Ștefan, țară, încă');
        expect(response.responseMeta).toMatchObject({
            traceId: TRACE_ID,
            rateLimitLimit: 240,
            rateLimitRemaining: 239,
            dailyLimit: 1000,
            dailyRemaining: 999,
        });
    });

    it('sends the query of a list and reads the page', async () => {
        server = await startServer((_request, response) => {
            sendJson(response, 200, pageOf([messageData()], 'messages', 2, true));
        });

        const page = await clientFor(server.url).messages.list({ page: 2 });

        expect(server.received[0]?.url).toBe('/api/v1/messages?page=2');
        expect(page.data[0]?.id).toBe(MESSAGE_ID);
        expect(page.hasNextPage).toBe(true);
    });

    it('cancels a message, answered with an empty array', async () => {
        server = await startServer((_request, response) => sendJson(response, 200, []));

        await expect(clientFor(server.url).messages.delete(MESSAGE_ID)).resolves.toBeUndefined();
        expect(server.received[0]).toMatchObject({ method: 'DELETE', url: `/api/v1/messages/${MESSAGE_ID}`, body: '' });
    });

    it('turns a daily limit refusal into a DailyLimitExceededError', async () => {
        server = await startServer((_request, response) => {
            sendJson(response, 429, DAILY_LIMIT_BODY, {
                'Retry-After': '21600',
                'X-Daily-Limit': '1000',
                'X-Daily-Remaining': '0',
                'X-Trace-Id': TRACE_ID,
            });
        });

        const error = await clientFor(server.url)
            .messages.create({ recipient: PHONE, body: 'Hello' })
            .catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(DailyLimitExceededError);
        expect(error).toMatchObject({
            statusCode: 429,
            traceId: TRACE_ID,
            retryAfter: 21600,
            dailyLimit: 1000,
            dailyRemaining: 0,
            resetsAt: '2026-10-01T00:00:00+03:00',
        });
    });

    it('turns validation errors into a ValidationError', async () => {
        server = await startServer((_request, response) => {
            sendJson(response, 422, {
                message: 'The recipient field is required.',
                errors: { recipient: ['The recipient field is required.'] },
                trace_id: TRACE_ID,
            });
        });

        const error = await clientFor(server.url)
            .messages.create({ recipient: '', body: 'Hello' })
            .catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).traceId).toBe(TRACE_ID);
        expect((error as ValidationError).validationErrors).toEqual({
            recipient: ['The recipient field is required.'],
        });
    });

    it('turns an HTML error page into a ServerError', async () => {
        server = await startServer((_request, response) => {
            response.writeHead(502, { 'Content-Type': 'text/html' }).end('<html><body>Bad Gateway</body></html>');
        });

        const error = await clientFor(server.url)
            .accounts.get('acc')
            .catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ServerError);
        expect((error as ServerError).message).toBe('HTTP error 502');
    });

    it('does not follow a redirect, so the API key stays on the API host', async () => {
        server = await startServer((request, response) => {
            if (request.url?.startsWith('/elsewhere')) {
                sendJson(response, 200, { data: messageData() });

                return;
            }

            response.writeHead(302, { Location: '/elsewhere' }).end();
        });

        const error = await clientFor(server.url)
            .messages.get(MESSAGE_ID)
            .catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(302);
        expect(server.received.map((request) => request.url)).toEqual([`/api/v1/messages/${MESSAGE_ID}`]);
    });

    it('gives up on a slow answer after the timeout', async () => {
        server = await startServer(async (_request, response) => {
            await new Promise((resolve) => setTimeout(resolve, 1_000));
            sendJson(response, 200, { data: messageData() });
        });

        const startedAt = Date.now();
        const error = await clientFor(server.url, 100)
            .messages.get(MESSAGE_ID)
            .catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(TransportError);
        expect((error as TransportError).message).toBe('HTTP request failed: Request timed out after 100 ms');
        expect((error as TransportError).statusCode).toBeNull();
        expect(Date.now() - startedAt).toBeLessThan(900);
    });

    it('stops when the caller aborts', async () => {
        server = await startServer(async (_request, response) => {
            await new Promise((resolve) => setTimeout(resolve, 1_000));
            sendJson(response, 200, { data: messageData() });
        });
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 50);

        const error = await clientFor(server.url)
            .messages.get(MESSAGE_ID, { signal: controller.signal })
            .catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(TransportError);
        expect(((error as TransportError).cause as Error).name).toBe('AbortError');
    });

    // Windows takes a couple of seconds to give up on a closed local port
    it('turns a refused connection into a TransportError', { timeout: 15_000 }, async () => {
        server = await startServer((_request, response) => sendJson(response, 200, {}));
        const { url } = server;
        await server.close();
        server = null;

        const error = await clientFor(url)
            .messages.list()
            .catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(TransportError);
        expect((error as TransportError).cause).toBeInstanceOf(Error);
    });

    it('keeps the answer of each of many concurrent requests apart', async () => {
        server = await startServer(async (request, response) => {
            const id = request.url?.split('/').pop() ?? '';
            // Answer in an order unrelated to the order of the requests
            await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 30)));
            sendJson(response, 200, { data: messageData({ id }) }, { 'X-Trace-Id': `trace-${id}` });
        });
        const client = clientFor(server.url);
        const ids = Array.from({ length: 20 }, (_, index) => `msg-${index}`);

        const responses = await Promise.all(ids.map((id) => client.messages.get(id)));

        expect(responses.map((response) => response.data.id)).toEqual(ids);
        expect(responses.map((response) => response.responseMeta.traceId)).toEqual(ids.map((id) => `trace-${id}`));
    });

    it('sends the User-Agent that identifies the library, the runtime and your application', async () => {
        server = await startServer((_request, response) => sendJson(response, 200, pageOf([], 'opt-outs')));
        const client = SmsClient.create('integration-key', {
            baseUrl: `${server.url}/api/v1`,
            appInfo: { name: 'My Shop', version: '2.1.0' },
        });

        await client.optOuts.list();

        const userAgent = server.received[0]?.headers['user-agent'];
        expect(userAgent).toBe(client.httpClient.userAgent);
        expect(userAgent).toMatch(
            /^Calisero-SMS-Node\/\d+\.\d+\.\d+ \(Node\.js v\d+\.\d+\.\d+; [a-z0-9]+ [a-z0-9]+\) My-Shop\/2\.1\.0$/,
        );
    });
});
