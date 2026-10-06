import { describe, expect, it, vi } from 'vitest';
import {
    AccountService,
    DEFAULT_BASE_URL,
    HttpClient,
    MessageService,
    OptOutService,
    SmsClient,
    TransportError,
    VerificationService,
} from '../../src/index.js';
import { messageData, pageOf } from '../support/fixtures.js';
import { jsonResponse, StubTransport } from '../support/StubTransport.js';

describe('SmsClient.create()', () => {
    it('creates a client with every service', () => {
        const client = SmsClient.create('test-token-123');

        expect(client).toBeInstanceOf(SmsClient);
        expect(client.messages).toBeInstanceOf(MessageService);
        expect(client.optOuts).toBeInstanceOf(OptOutService);
        expect(client.accounts).toBeInstanceOf(AccountService);
        expect(client.verifications).toBeInstanceOf(VerificationService);
        expect(client.httpClient).toBeInstanceOf(HttpClient);
    });

    it('returns the same service instance on every access', () => {
        const client = SmsClient.create('test-token-456');

        expect(client.messages).toBe(client.messages);
        expect(client.optOuts).toBe(client.optOuts);
        expect(client.accounts).toBe(client.accounts);
        expect(client.verifications).toBe(client.verifications);
    });

    it('creates independent clients', () => {
        const first = SmsClient.create('client-1-token');
        const second = SmsClient.create('client-2-token');

        expect(first).not.toBe(second);
        expect(first.messages).not.toBe(second.messages);
        expect(first.optOuts).not.toBe(second.optOuts);
        expect(first.accounts).not.toBe(second.accounts);
        expect(first.verifications).not.toBe(second.verifications);
    });

    it('sends to the production API by default', () => {
        expect(SmsClient.create('test-token').httpClient.baseUrl).toBe('https://rest.calisero.ro/api/v1');
        expect(DEFAULT_BASE_URL).toBe('https://rest.calisero.ro/api/v1');
    });

    it.each([
        ['an empty string', ''],
        ['blank', '   '],
        ['undefined', undefined],
    ])('refuses an API key that is %s', (_, apiKey) => {
        expect(() => SmsClient.create(apiKey)).toThrow(new TypeError('The API key must be a non-empty string.'));
    });

    it('authenticates every request with the API key', async () => {
        const transport = new StubTransport(jsonResponse(200, pageOf([], 'messages')));
        const client = SmsClient.create('my-api-key', { transport });

        await client.messages.list();

        expect(transport.lastRequest.headers.Authorization).toBe('Bearer my-api-key');
    });

    it('authenticates with an auth provider of your own, read before each request', async () => {
        const tokens = ['first-token', 'rotated-token'];
        const getToken = vi.fn(async () => tokens.shift() ?? 'none');
        const transport = new StubTransport(
            jsonResponse(200, pageOf([], 'messages')),
            jsonResponse(200, pageOf([], 'messages')),
        );
        const client = SmsClient.create({ getToken }, { transport });

        await client.messages.list();
        await client.messages.list();

        expect(getToken).toHaveBeenCalledTimes(2);
        expect(transport.requests.map((request) => request.headers.Authorization)).toEqual([
            'Bearer first-token',
            'Bearer rotated-token',
        ]);
    });

    it('sends to the given base URL', async () => {
        const transport = new StubTransport(jsonResponse(200, pageOf([], 'messages')));
        const client = SmsClient.create('test-token', { transport, baseUrl: 'https://staging.example.test/api/v1/' });

        await client.messages.list();

        expect(transport.lastRequest.url).toBe('https://staging.example.test/api/v1/messages');
    });

    it('names your application in the User-Agent after the library', async () => {
        const transport = new StubTransport(jsonResponse(200, pageOf([], 'messages')));
        const client = SmsClient.create('test-token', { transport, appInfo: { name: 'MyShop', version: '2.1.0' } });

        await client.messages.list();

        expect(client.httpClient.userAgent).toMatch(/^Calisero-SMS-Node\/\S+ \(Node\.js .+\) MyShop\/2\.1\.0$/);
        expect(transport.lastRequest.headers['User-Agent']).toBe(client.httpClient.userAgent);
        expect(() => SmsClient.create('test-token', { appInfo: { name: '' } })).toThrow(TypeError);
    });

    it('sends through the given fetch', async () => {
        const fetch = vi.fn<typeof globalThis.fetch>(
            async () => new Response(JSON.stringify({ data: messageData() }), { status: 200 }),
        );
        const client = SmsClient.create('test-token', { fetch });

        const response = await client.messages.get('msg-1');

        expect(response.data.id).toBe(messageData().id);
        expect(fetch).toHaveBeenCalledOnce();
        expect(fetch.mock.calls[0]?.[0]).toBe('https://rest.calisero.ro/api/v1/messages/msg-1');
    });

    it('gives up after the given timeout', async () => {
        const fetch: typeof globalThis.fetch = (_, init) =>
            new Promise((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
            });
        const client = SmsClient.create('test-token', { fetch, timeout: 20 });

        const error = await client.messages.get('msg-1').catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(TransportError);
        expect((error as TransportError).message).toBe('HTTP request failed: Request timed out after 20 ms');
    });

    it('refuses a timeout that is not a positive number of milliseconds', () => {
        expect(() => SmsClient.create('test-token', { timeout: 0 })).toThrow(RangeError);
        expect(() => SmsClient.create('test-token', { timeout: -5 })).toThrow(RangeError);
        expect(() => SmsClient.create('test-token', { timeout: Number.NaN })).toThrow(RangeError);
    });

    it('builds on an HTTP client of your own', async () => {
        const transport = new StubTransport(jsonResponse(200, pageOf([], 'opt-outs')));
        const httpClient = new HttpClient({ authProvider: { getToken: () => 'custom' }, transport });
        const client = new SmsClient(httpClient);

        await client.optOuts.list();

        expect(client.httpClient).toBe(httpClient);
        expect(transport.lastRequest.headers.Authorization).toBe('Bearer custom');
    });
});
