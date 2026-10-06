import type { Transport } from '../contracts/Transport.js';
import type { HttpRequest } from './HttpRequest.js';
import { HttpResponse } from './HttpResponse.js';

export interface FetchTransportOptions {
    /**
     * Milliseconds to wait for the whole answer, headers and body: 30 000 by default.
     */
    readonly timeout?: number | undefined;

    /**
     * The fetch implementation, e.g. undici's fetch with a proxy dispatcher: the
     * global fetch of Node.js by default.
     */
    readonly fetch?: typeof globalThis.fetch | undefined;
}

/**
 * The default transport: the fetch API built into Node.js, no dependency.
 *
 * Redirects are not followed (a 3xx answer is an error, and the API key never
 * goes to another host), and the whole exchange is bounded by the timeout.
 */
export class FetchTransport implements Transport {
    static readonly DEFAULT_TIMEOUT = 30_000;

    /**
     * Milliseconds to wait for the whole answer.
     */
    readonly timeout: number;

    readonly #fetch: typeof globalThis.fetch;

    constructor(options: FetchTransportOptions = {}) {
        const timeout = options.timeout ?? FetchTransport.DEFAULT_TIMEOUT;

        if (typeof timeout !== 'number' || !Number.isFinite(timeout) || timeout <= 0) {
            throw new RangeError(`The timeout must be a positive number of milliseconds, got ${String(timeout)}.`);
        }

        const fetchImplementation = options.fetch ?? globalThis.fetch;

        if (typeof fetchImplementation !== 'function') {
            throw new TypeError(
                'No fetch implementation available: use Node.js 20.19 or later, or pass one as `fetch`.',
            );
        }

        this.timeout = timeout;
        this.#fetch = fetchImplementation;
    }

    async send(request: HttpRequest): Promise<HttpResponse> {
        const timeoutSignal = AbortSignal.timeout(this.timeout);
        const signal = request.signal ? AbortSignal.any([request.signal, timeoutSignal]) : timeoutSignal;
        const fetch = this.#fetch;

        try {
            const response = await fetch(request.url, {
                method: request.method,
                headers: request.headers,
                body: request.body,
                redirect: 'manual',
                signal,
            });
            const body = await response.text();

            return new HttpResponse(response.status, response.headers, body);
        } catch (error) {
            if (timeoutSignal.aborted && !request.signal?.aborted) {
                throw new Error(`Request timed out after ${this.timeout} ms`, { cause: error });
            }

            throw error;
        }
    }
}
