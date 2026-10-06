import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    createDeliveryWebhookHandler,
    type DeliveryWebhookHandlerOptions,
    DeliveryWebhookMessage,
    InvalidWebhookPayloadError,
    type WebhookRequest,
} from '../../../src/index.js';
import { webhookPayload } from '../../support/fixtures.js';
import { type LocalServer, startRawServer } from '../../support/localServer.js';

let server: LocalServer | null = null;

afterEach(async () => {
    await server?.close();
    server = null;
});

/**
 * A local server running the handler, after `prepare` (e.g. an Express body parser).
 */
async function serve(
    options: DeliveryWebhookHandlerOptions,
    prepare?: (request: WebhookRequest, response: ServerResponse) => Promise<void>,
): Promise<string> {
    const handler = createDeliveryWebhookHandler(options);

    server = await startRawServer((request: IncomingMessage, response: ServerResponse) => {
        void (async () => {
            await prepare?.(request, response);
            await handler(request, response);
        })();
    });

    return server.url;
}

async function post(url: string, body: string, headers: Record<string, string> = {}): Promise<Response> {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });
}

async function readAll(request: IncomingMessage): Promise<Buffer> {
    const chunks: Buffer[] = [];

    for await (const chunk of request) {
        chunks.push(chunk as Buffer);
    }

    return Buffer.concat(chunks);
}

describe('createDeliveryWebhookHandler()', () => {
    it('hands the delivery status update to onMessage and answers 200', async () => {
        const onMessage = vi.fn();
        const url = await serve({ onMessage });

        const response = await post(`${url}/webhooks/calisero`, JSON.stringify(webhookPayload()));

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toBe('application/json');
        expect(await response.json()).toEqual({ received: true });
        expect(onMessage).toHaveBeenCalledOnce();
        const [message, request] = onMessage.mock.calls[0] ?? [];
        expect(message).toBeInstanceOf(DeliveryWebhookMessage);
        expect((message as DeliveryWebhookMessage).status).toBe('delivered');
        expect((request as IncomingMessage).url).toBe('/webhooks/calisero');
    });

    it('answers only once onMessage is done', async () => {
        const events: string[] = [];
        const url = await serve({
            onMessage: async () => {
                await new Promise((resolve) => setTimeout(resolve, 30));
                events.push('handled');
            },
        });

        const response = await post(url, JSON.stringify(webhookPayload()));
        events.push(`answered ${response.status}`);

        expect(events).toEqual(['handled', 'answered 200']);
    });

    it('answers 405 to anything but POST', async () => {
        const onMessage = vi.fn();
        const url = await serve({ onMessage });

        const response = await fetch(url);

        expect(response.status).toBe(405);
        expect(response.headers.get('allow')).toBe('POST');
        expect(onMessage).not.toHaveBeenCalled();
    });

    it('answers 400 to a payload that is not JSON, and reports it', async () => {
        const onMessage = vi.fn();
        const onError = vi.fn();
        const url = await serve({ onMessage, onError });

        const response = await post(url, '{not json');

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: 'Invalid payload' });
        expect(onMessage).not.toHaveBeenCalled();
        expect(onError).toHaveBeenCalledOnce();
        expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(InvalidWebhookPayloadError);
    });

    it('answers 400 to the [] sent for a cancelled message', async () => {
        const url = await serve({ onMessage: vi.fn() });

        expect((await post(url, '[]')).status).toBe(400);
    });

    it('answers 400 to a payload without a required field', async () => {
        const url = await serve({ onMessage: vi.fn() });

        expect((await post(url, JSON.stringify(webhookPayload({ messageId: undefined })))).status).toBe(400);
    });

    it('answers 413 to a payload larger than maxBodySize', async () => {
        const onError = vi.fn();
        const url = await serve({ onMessage: vi.fn(), onError, maxBodySize: 100 });

        const response = await post(url, JSON.stringify(webhookPayload({ sender: 'x'.repeat(200) })));

        expect(response.status).toBe(413);
        expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(InvalidWebhookPayloadError);
    });

    it('answers 500 when onMessage fails, and reports it', async () => {
        const failure = new Error('Database down');
        const onError = vi.fn();
        const url = await serve({
            onMessage: () => {
                throw failure;
            },
            onError,
        });

        const response = await post(url, JSON.stringify(webhookPayload()));

        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ error: 'Webhook handler failed' });
        expect(onError.mock.calls[0]?.[0]).toBe(failure);
    });

    it('does not answer again when onMessage answered itself', async () => {
        const onError = vi.fn();
        const url = await serve(
            {
                onMessage: (_message, request) => {
                    (request as WebhookRequest & { res: ServerResponse }).res.writeHead(202).end('accepted');
                },
                onError,
            },
            async (request, response) => {
                // Express links the response to the request this way
                (request as WebhookRequest & { res: ServerResponse }).res = response;
            },
        );

        const response = await post(url, JSON.stringify(webhookPayload()));

        expect(response.status).toBe(202);
        expect(await response.text()).toBe('accepted');
        expect(onError).not.toHaveBeenCalled();
    });

    describe('with a token', () => {
        it('accepts a request whose URL carries the token', async () => {
            const onMessage = vi.fn();
            const url = await serve({ onMessage, token: 's3cr3t-t0ken' });

            const response = await post(
                `${url}/webhooks/calisero?token=s3cr3t-t0ken`,
                JSON.stringify(webhookPayload()),
            );

            expect(response.status).toBe(200);
            expect(onMessage).toHaveBeenCalledOnce();
        });

        it.each([
            ['without a token', ''],
            ['with a wrong token', '?token=guess'],
            ['with a longer token', '?token=s3cr3t-t0ken-and-more'],
            ['with an empty token', '?token='],
        ])('answers 401 to a request %s', async (_, query) => {
            const onMessage = vi.fn();
            const onError = vi.fn();
            const url = await serve({ onMessage, onError, token: 's3cr3t-t0ken' });

            const response = await post(`${url}/webhooks/calisero${query}`, JSON.stringify(webhookPayload()));

            expect(response.status).toBe(401);
            expect(await response.json()).toEqual({ error: 'Invalid webhook token' });
            expect(onMessage).not.toHaveBeenCalled();
            expect(onError).toHaveBeenCalledOnce();
        });

        it('reads the token from the original URL Express keeps for a mounted router', async () => {
            const onMessage = vi.fn();
            const url = await serve({ onMessage, token: 's3cr3t-t0ken' }, async (request) => {
                request.originalUrl = request.url ?? '/';
                request.url = '/';
            });

            expect((await post(`${url}/hooks?token=s3cr3t-t0ken`, JSON.stringify(webhookPayload()))).status).toBe(200);
        });
    });

    describe('behind Express body parsers', () => {
        it('reads the body express.json() decoded', async () => {
            const onMessage = vi.fn();
            const url = await serve({ onMessage }, async (request) => {
                request.body = JSON.parse((await readAll(request)).toString('utf8'));
            });

            expect((await post(url, JSON.stringify(webhookPayload()))).status).toBe(200);
            const message = onMessage.mock.calls[0]?.[0] as DeliveryWebhookMessage | undefined;
            expect(message?.messageId).toBe(webhookPayload().messageId);
        });

        it('reads a body a middleware set to arrive as text', async () => {
            const onMessage = vi.fn();
            const url = await serve({ onMessage }, async (request) => {
                request.setEncoding('utf8');
            });

            expect((await post(url, JSON.stringify(webhookPayload({ recipient: '+40742***352' })))).status).toBe(200);
            expect((onMessage.mock.calls[0]?.[0] as DeliveryWebhookMessage | undefined)?.recipient).toBe(
                '+40742***352',
            );
        });

        it('reads the Buffer express.raw() left', async () => {
            const onMessage = vi.fn();
            const url = await serve({ onMessage }, async (request) => {
                request.body = await readAll(request);
            });

            expect((await post(url, JSON.stringify(webhookPayload()))).status).toBe(200);
            expect(onMessage).toHaveBeenCalledOnce();
        });

        it('reads the string express.text() left', async () => {
            const onMessage = vi.fn();
            const url = await serve({ onMessage }, async (request) => {
                request.body = (await readAll(request)).toString('utf8');
            });

            expect((await post(url, JSON.stringify(webhookPayload()))).status).toBe(200);
            expect(onMessage).toHaveBeenCalledOnce();
        });

        it('answers 400 when another middleware consumed the body', async () => {
            const url = await serve({ onMessage: vi.fn() }, async (request) => {
                await readAll(request);
            });

            expect((await post(url, JSON.stringify(webhookPayload()))).status).toBe(400);
        });
    });

    it('refuses a request without a URL when a token is required', async () => {
        // A request built by hand, as some frameworks and tests do
        const request = Object.assign(Readable.from([Buffer.from(JSON.stringify(webhookPayload()))]), {
            method: 'POST',
            url: undefined,
            headers: {},
        }) as unknown as WebhookRequest;
        const answers: { status: number; body: string }[] = [];
        const response = {
            headersSent: false,
            writeHead(status: number) {
                answers.push({ status, body: '' });

                return this;
            },
            end(body: string) {
                const last = answers.at(-1);

                if (last) {
                    last.body = body;
                }
            },
        } as unknown as ServerResponse;

        await createDeliveryWebhookHandler({ onMessage: vi.fn(), token: 's3cr3t-t0ken' })(request, response);

        expect(answers).toEqual([{ status: 401, body: '{"error":"Invalid webhook token"}' }]);
    });

    describe('options', () => {
        it('needs an onMessage function', () => {
            expect(() => createDeliveryWebhookHandler({} as unknown as DeliveryWebhookHandlerOptions)).toThrow(
                new TypeError('createDeliveryWebhookHandler() needs an onMessage function.'),
            );
        });

        it('refuses an empty token', () => {
            expect(() => createDeliveryWebhookHandler({ onMessage: vi.fn(), token: '' })).toThrow(
                new TypeError('The webhook token must be a non-empty string.'),
            );
        });

        it.each([0, -1, 1.5])('refuses the maxBodySize %s', (maxBodySize) => {
            expect(() => createDeliveryWebhookHandler({ onMessage: vi.fn(), maxBodySize })).toThrow(RangeError);
        });
    });
});
