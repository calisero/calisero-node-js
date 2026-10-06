import { describe, expect, it, vi } from 'vitest';
import { FetchTransport, type HttpRequest, HttpResponse } from '../../../src/index.js';

const request: HttpRequest = {
    method: 'POST',
    url: 'https://rest.calisero.ro/api/v1/messages',
    headers: { Accept: 'application/json', Authorization: 'Bearer key' },
    body: '{"recipient":"+40742***350","body":"Hello"}',
};

/**
 * A fetch that never answers: it rejects once its signal aborts.
 */
const hangingFetch: typeof globalThis.fetch = (_, init) =>
    new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    });

describe('FetchTransport', () => {
    it('sends the request through fetch, without following redirects', async () => {
        const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response('{}', { status: 201 }));

        await new FetchTransport({ fetch }).send(request);

        expect(fetch).toHaveBeenCalledOnce();
        const [url, init] = fetch.mock.calls[0] ?? [];
        expect(url).toBe(request.url);
        expect(init).toMatchObject({
            method: 'POST',
            headers: request.headers,
            body: request.body,
            redirect: 'manual',
        });
        expect(init?.signal).toBeInstanceOf(AbortSignal);
    });

    it('sends no body when the request has none', async () => {
        const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response('{}'));

        await new FetchTransport({ fetch }).send({ ...request, method: 'GET', body: null });

        expect(fetch.mock.calls[0]?.[1]?.body).toBeNull();
    });

    it('returns the status, the headers and the body of the answer', async () => {
        const fetch: typeof globalThis.fetch = async () =>
            new Response('{"data":{"id":"msg_1"}}', {
                status: 201,
                headers: { 'X-Trace-Id': 'trace-1', 'X-RateLimit-Remaining': '239' },
            });

        const response = await new FetchTransport({ fetch }).send(request);

        expect(response).toBeInstanceOf(HttpResponse);
        expect(response.status).toBe(201);
        expect(response.body).toBe('{"data":{"id":"msg_1"}}');
        expect(response.getHeader('X-Trace-Id')).toEqual(['trace-1']);
        expect(response.getHeader('x-ratelimit-remaining')).toEqual(['239']);
    });

    it('rejects once the timeout elapses', async () => {
        const error = await new FetchTransport({ fetch: hangingFetch, timeout: 25 })
            .send(request)
            .catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Request timed out after 25 ms');
        expect(((error as Error).cause as Error).name).toBe('TimeoutError');
    });

    it('rejects with the abort reason when the caller aborts', async () => {
        const controller = new AbortController();
        const sending = new FetchTransport({ fetch: hangingFetch }).send({ ...request, signal: controller.signal });

        controller.abort();

        await expect(sending).rejects.toMatchObject({ name: 'AbortError' });
    });

    it('lets a network error through', async () => {
        const failure = new TypeError('fetch failed');
        const fetch: typeof globalThis.fetch = async () => {
            throw failure;
        };

        await expect(new FetchTransport({ fetch }).send(request)).rejects.toBe(failure);
    });

    it('waits 30 seconds by default', () => {
        expect(new FetchTransport().timeout).toBe(30_000);
        expect(FetchTransport.DEFAULT_TIMEOUT).toBe(30_000);
    });

    it('uses the global fetch by default', async () => {
        const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));

        await new FetchTransport().send(request);

        expect(fetch).toHaveBeenCalledOnce();
    });

    it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, '30' as unknown as number])(
        'refuses the timeout %s',
        (timeout) => {
            expect(() => new FetchTransport({ timeout })).toThrow(RangeError);
        },
    );

    it('refuses a fetch that is not a function', () => {
        expect(() => new FetchTransport({ fetch: 'fetch' as unknown as typeof globalThis.fetch })).toThrow(TypeError);
    });
});
