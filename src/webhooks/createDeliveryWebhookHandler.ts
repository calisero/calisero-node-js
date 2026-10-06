import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { DeliveryWebhookMessage } from '../dto/DeliveryWebhookMessage.js';
import { InvalidWebhookPayloadError } from '../errors.js';

/**
 * The request as Node.js hands it; Express adds the body its parsers read.
 */
export type WebhookRequest = IncomingMessage & { body?: unknown; originalUrl?: string };

export type DeliveryWebhookHandler = (request: WebhookRequest, response: ServerResponse) => Promise<void>;

export interface DeliveryWebhookHandlerOptions {
    /**
     * Called with every delivery status update. The answer is sent once it returns
     * (or its promise settles), and Calisero waits 2 seconds for it: record the
     * status or queue a job, then return.
     */
    readonly onMessage: (message: DeliveryWebhookMessage, request: WebhookRequest) => void | Promise<void>;

    /**
     * A secret the callback URL carries as its `token` query parameter, e.g.
     * `https://yourapp.com/webhooks/calisero?token=…`: a request without it is
     * answered 401. Calisero does not sign its callbacks, so this is how to accept
     * only the callbacks of the URLs you gave it.
     */
    readonly token?: string | undefined;

    /**
     * Called when a request is refused or `onMessage` fails, e.g. to log it.
     */
    readonly onError?: ((error: unknown, request: WebhookRequest) => void) | undefined;

    /**
     * The largest body accepted, in bytes: 64 KiB by default.
     */
    readonly maxBodySize?: number | undefined;
}

const DEFAULT_MAX_BODY_SIZE = 64 * 1024;

/**
 * A request handler for the delivery status callbacks, for `node:http` and for
 * Express (with or without `express.json()` before it):
 *
 * - 200 `{"received":true}` once `onMessage` handled the update;
 * - 400 for a payload that is not a delivery status update, 413 for one too large;
 * - 401 when `token` is set and the request URL lacks it;
 * - 405 for anything but POST;
 * - 500 when `onMessage` throws. Calisero retries only a callback that got no
 *   answer within 2 seconds, never one answered with an error.
 */
export function createDeliveryWebhookHandler(options: DeliveryWebhookHandlerOptions): DeliveryWebhookHandler {
    const { onMessage, onError, token } = options;
    const maxBodySize = options.maxBodySize ?? DEFAULT_MAX_BODY_SIZE;

    if (typeof onMessage !== 'function') {
        throw new TypeError('createDeliveryWebhookHandler() needs an onMessage function.');
    }

    if (token !== undefined && (typeof token !== 'string' || token === '')) {
        throw new TypeError('The webhook token must be a non-empty string.');
    }

    if (!Number.isSafeInteger(maxBodySize) || maxBodySize <= 0) {
        throw new RangeError(`maxBodySize must be a positive number of bytes, got ${String(maxBodySize)}.`);
    }

    return async (request, response) => {
        if (request.method !== 'POST') {
            answer(response, 405, { error: 'Method not allowed' }, { Allow: 'POST' });

            return;
        }

        if (token !== undefined && !hasToken(request, token)) {
            onError?.(new Error('Invalid webhook token: the request URL lacks the expected token.'), request);
            answer(response, 401, { error: 'Invalid webhook token' });

            return;
        }

        let message: DeliveryWebhookMessage;

        try {
            message = await readMessage(request, maxBodySize);
        } catch (error) {
            onError?.(error, request);

            if (error instanceof PayloadTooLargeError) {
                answer(response, 413, { error: 'Payload too large' });
            } else {
                answer(response, 400, { error: 'Invalid payload' });
            }

            return;
        }

        try {
            await onMessage(message, request);
        } catch (error) {
            onError?.(error, request);
            answer(response, 500, { error: 'Webhook handler failed' });

            return;
        }

        answer(response, 200, { received: true });
    };
}

class PayloadTooLargeError extends InvalidWebhookPayloadError {}

async function readMessage(request: WebhookRequest, maxBodySize: number): Promise<DeliveryWebhookMessage> {
    const { body } = request;

    // express.text() and express.raw() leave the body as it came
    if (typeof body === 'string' || body instanceof Uint8Array) {
        return DeliveryWebhookMessage.fromJson(body);
    }

    // express.json() decoded it
    if (body !== undefined && body !== null) {
        return DeliveryWebhookMessage.fromObject(body);
    }

    return DeliveryWebhookMessage.fromJson(await readBody(request, maxBodySize));
}

async function readBody(request: IncomingMessage, maxBodySize: number): Promise<Buffer> {
    if (request.readableEnded) {
        return Buffer.alloc(0);
    }

    const chunks: Buffer[] = [];
    let size = 0;

    for await (const chunk of request) {
        const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer);
        size += buffer.length;

        if (size > maxBodySize) {
            throw new PayloadTooLargeError(`Invalid delivery webhook payload: larger than ${maxBodySize} bytes.`);
        }

        chunks.push(buffer);
    }

    return Buffer.concat(chunks);
}

function hasToken(request: WebhookRequest, expected: string): boolean {
    // Express rewrites `url` under a mounted router and keeps the original in `originalUrl`
    const url = new URL(request.originalUrl ?? request.url ?? '/', 'http://localhost');
    const provided = url.searchParams.get('token');

    if (provided === null) {
        return false;
    }

    // Hashes of equal length, compared in constant time
    return timingSafeEqual(sha256(provided), sha256(expected));
}

function sha256(value: string): Buffer {
    return createHash('sha256').update(value).digest();
}

function answer(
    response: ServerResponse,
    status: number,
    body: Record<string, unknown>,
    headers: Record<string, string> = {},
): void {
    if (response.headersSent) {
        return;
    }

    response.writeHead(status, { 'Content-Type': 'application/json', ...headers });
    response.end(JSON.stringify(body));
}
