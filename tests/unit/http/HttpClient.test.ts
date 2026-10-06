import { describe, expect, it, vi } from 'vitest';
import { ApiError, HttpClient, HttpResponse, TransportError, VERSION } from '../../../src/index.js';
import { TRACE_ID } from '../../support/fixtures.js';
import { httpClientAnswering, jsonResponse, StubTransport } from '../../support/StubTransport.js';

const BASE = 'https://rest.calisero.ro/api/v1';
const RUNTIME = `(Node.js ${process.version}; ${process.platform} ${process.arch})`;

describe('HttpClient requests', () => {
    it('sends a GET with the standard headers and no body', async () => {
        const { httpClient, transport } = httpClientAnswering(jsonResponse(200, { data: [] }));

        await httpClient.get('/messages');

        expect(transport.lastRequest).toEqual({
            method: 'GET',
            url: `${BASE}/messages`,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': `Calisero-SMS-Node/${VERSION} ${RUNTIME}`,
                Authorization: 'Bearer test-api-key',
            },
            body: null,
            signal: undefined,
        });
    });

    it('names the library, its version and the runtime in the User-Agent of every request', async () => {
        const { httpClient, transport } = httpClientAnswering(jsonResponse(200, {}), jsonResponse(201, {}));

        await httpClient.get('/messages');
        await httpClient.post('/messages', { recipient: '+40742***350', body: 'Hello' });

        expect(httpClient.userAgent).toBe(`Calisero-SMS-Node/${VERSION} ${RUNTIME}`);
        expect(transport.requests.map((request) => request.headers['User-Agent'])).toEqual([
            httpClient.userAgent,
            httpClient.userAgent,
        ]);
    });

    it('names your application after the library in the User-Agent', async () => {
        const transport = new StubTransport(jsonResponse(200, {}));
        const httpClient = new HttpClient({
            authProvider: { getToken: () => 'key' },
            transport,
            appInfo: { name: 'MyShop', version: '2.1.0' },
        });

        await httpClient.get('/messages');

        expect(transport.lastRequest.headers['User-Agent']).toBe(
            `Calisero-SMS-Node/${VERSION} ${RUNTIME} MyShop/2.1.0`,
        );
    });

    it('refuses an application without a usable name', () => {
        expect(() => new HttpClient({ authProvider: { getToken: () => 'key' }, appInfo: { name: '  ' } })).toThrow(
            new TypeError('appInfo.name must name your application with letters, digits or -._ characters.'),
        );
    });

    it('adds the query parameters it is given, leaving out null and undefined', async () => {
        const { httpClient, transport } = httpClientAnswering(jsonResponse(200, {}), jsonResponse(200, {}));

        await httpClient.get('/verifications', { page: 2, status: 'verified', skipped: null, missing: undefined });
        await httpClient.get('/verifications', { skipped: null });

        expect(transport.requests[0]?.url).toBe(`${BASE}/verifications?page=2&status=verified`);
        expect(transport.requests[1]?.url).toBe(`${BASE}/verifications`);
    });

    it('encodes the query parameters', async () => {
        const { httpClient, transport } = httpClientAnswering(jsonResponse(200, {}));

        await httpClient.get('/messages', { q: 'a b&c=d' });

        expect(transport.lastRequest.url).toBe(`${BASE}/messages?q=a+b%26c%3Dd`);
    });

    it('sends a POST with a JSON body', async () => {
        const { httpClient, transport } = httpClientAnswering(jsonResponse(201, { data: { id: 'msg_1' } }));

        const result = await httpClient.post('/messages', { recipient: '+40742***350', body: 'Bună ziua!' });

        expect(transport.lastRequest.method).toBe('POST');
        expect(transport.lastRequest.url).toBe(`${BASE}/messages`);
        expect(transport.lastRequest.body).toBe('{"recipient":"+40742***350","body":"Bună ziua!"}');
        expect(result.body).toEqual({ data: { id: 'msg_1' } });
        expect(result.response.status).toBe(201);
    });

    it('sends a POST without data without a body', async () => {
        const { httpClient, transport } = httpClientAnswering(jsonResponse(200, {}));

        await httpClient.post('/messages');

        expect(transport.lastRequest.body).toBeNull();
    });

    it('sends a PUT with a JSON body', async () => {
        const { httpClient, transport } = httpClientAnswering(jsonResponse(200, { data: {} }));

        await httpClient.put('/verifications/validate', { phone: '+40742***350', code: 'ABC123' });

        expect(transport.lastRequest.method).toBe('PUT');
        expect(transport.lastRequest.body).toBe('{"phone":"+40742***350","code":"ABC123"}');
    });

    it('sends a DELETE without a body and reads its answer', async () => {
        // The API answers a delete with 200 and an empty JSON array
        const { httpClient, transport } = httpClientAnswering(jsonResponse(200, []));

        const result = await httpClient.delete('/messages/msg_1');

        expect(transport.lastRequest.method).toBe('DELETE');
        expect(transport.lastRequest.url).toBe(`${BASE}/messages/msg_1`);
        expect(transport.lastRequest.body).toBeNull();
        expect(result.body).toEqual([]);
    });

    it('reads an answer without a body as null', async () => {
        const { httpClient } = httpClientAnswering(new HttpResponse(204, {}, ''));

        expect((await httpClient.delete('/opt-outs/opt_1')).body).toBeNull();
    });

    it('joins the base URL and the path with a single slash', async () => {
        const transport = new StubTransport(jsonResponse(200, {}), jsonResponse(200, {}));
        const httpClient = new HttpClient({
            authProvider: { getToken: () => 'key' },
            transport,
            baseUrl: 'https://rest.calisero.ro/api/v1//',
        });

        await httpClient.get('messages');
        await httpClient.get('//messages');

        expect(transport.requests.map((request) => request.url)).toEqual([`${BASE}/messages`, `${BASE}/messages`]);
    });

    it('passes the abort signal to the transport', async () => {
        const { httpClient, transport } = httpClientAnswering(jsonResponse(200, {}));
        const controller = new AbortController();

        await httpClient.get('/messages', {}, { signal: controller.signal });

        expect(transport.lastRequest.signal).toBe(controller.signal);
    });

    it('awaits an asynchronous auth provider', async () => {
        const transport = new StubTransport(jsonResponse(200, {}));
        const httpClient = new HttpClient({ authProvider: { getToken: async () => 'from-vault' }, transport });

        await httpClient.get('/messages');

        expect(transport.lastRequest.headers.Authorization).toBe('Bearer from-vault');
    });

    it('lets an auth provider error through, without sending the request', async () => {
        const failure = new Error('Vault unreachable');
        const transport = new StubTransport();
        const send = vi.spyOn(transport, 'send');
        const httpClient = new HttpClient({
            authProvider: {
                getToken: () => {
                    throw failure;
                },
            },
            transport,
        });

        await expect(httpClient.get('/messages')).rejects.toBe(failure);
        expect(send).not.toHaveBeenCalled();
    });

    it('sends no Idempotency-Key: the API takes none', async () => {
        const { httpClient, transport } = httpClientAnswering(jsonResponse(201, {}));

        await httpClient.post('/messages', { recipient: '+40742***350', body: 'Hello' });

        expect(Object.keys(transport.lastRequest.headers)).not.toContain('Idempotency-Key');
    });

    it('sends through fetch to the production API by default', async () => {
        const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"data":[]}'));
        const httpClient = new HttpClient({ authProvider: { getToken: () => 'key' } });

        await httpClient.get('/opt-outs');

        expect(httpClient.baseUrl).toBe(BASE);
        expect(fetch).toHaveBeenCalledOnce();
        expect(fetch.mock.calls[0]?.[0]).toBe(`${BASE}/opt-outs`);
    });
});

describe('HttpClient answers', () => {
    it('decodes a JSON answer', async () => {
        const { httpClient } = httpClientAnswering(jsonResponse(200, { data: { id: 'msg_1', parts: 2 } }));

        expect((await httpClient.get('/messages/msg_1')).body).toEqual({ data: { id: 'msg_1', parts: 2 } });
    });

    it('refuses a successful answer that is not JSON', async () => {
        const { httpClient } = httpClientAnswering(
            new HttpResponse(200, { 'X-Trace-Id': TRACE_ID }, '<html>OK</html>'),
        );

        const error = await httpClient.get('/messages').catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).message).toMatch(/^Failed to decode JSON response: /);
        expect((error as ApiError).statusCode).toBe(200);
        expect((error as ApiError).traceId).toBe(TRACE_ID);
        expect((error as ApiError).cause).toBeInstanceOf(SyntaxError);
    });
});

describe('HttpClient.lastResponse', () => {
    it('keeps the answer of every request', async () => {
        const success = jsonResponse(201, { data: { id: 'msg_1' } }, { 'X-Trace-Id': TRACE_ID });
        const failure = jsonResponse(404, { message: 'Resource not found!' });
        const { httpClient } = httpClientAnswering(success, failure);

        expect(httpClient.lastResponse).toBeNull();

        await httpClient.post('/messages', { recipient: '+40742***350', body: 'Hello' });
        expect(httpClient.lastResponse).toBe(success);

        await expect(httpClient.get('/messages/missing')).rejects.toThrow('Resource not found!');
        expect(httpClient.lastResponse).toBe(failure);
    });

    it('is cleared when a request gets no answer', async () => {
        const { httpClient } = httpClientAnswering(jsonResponse(200, { data: [] }), new Error('Connection timed out'));

        await httpClient.get('/messages');
        expect(httpClient.lastResponse).not.toBeNull();

        await expect(httpClient.get('/messages')).rejects.toBeInstanceOf(TransportError);
        expect(httpClient.lastResponse).toBeNull();
    });
});
