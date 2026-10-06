import { describe, expect, it } from 'vitest';
import {
    ApiError,
    ApiResponse,
    DailyLimitExceededError,
    ForbiddenError,
    Message,
    Paginated,
    ResponseMeta,
    ValidationError,
} from '../../../src/index.js';
import {
    DAILY_LIMIT_BODY,
    MESSAGE_ID,
    messageData,
    PHONE,
    pageOf,
    shortenedLinkData,
    TRACE_ID,
} from '../../support/fixtures.js';
import { clientAnswering, jsonResponse, requestBody } from '../../support/StubTransport.js';

const BASE = 'https://rest.calisero.ro/api/v1';

describe('MessageService.create()', () => {
    it('sends the message with its options and reads the created message', async () => {
        const { client, transport } = clientAnswering(
            jsonResponse(201, {
                data: messageData({ validity: undefined, callback_url: 'https://yourapp.com/webhooks/sms' }),
            }),
        );

        const response = await client.messages.create({
            recipient: PHONE,
            body: 'Hello from Calisero!',
            validity: 24,
            callbackUrl: 'https://yourapp.com/webhooks/sms',
            sender: 'CALISERO',
        });

        expect(transport.lastRequest.method).toBe('POST');
        expect(transport.lastRequest.url).toBe(`${BASE}/messages`);
        expect(requestBody(transport.lastRequest)).toEqual({
            recipient: PHONE,
            body: 'Hello from Calisero!',
            validity: 24,
            callback_url: 'https://yourapp.com/webhooks/sms',
            sender: 'CALISERO',
        });
        expect(response).toBeInstanceOf(ApiResponse);
        expect(response.data).toBeInstanceOf(Message);
        expect(response.data.id).toBe(MESSAGE_ID);
        expect(response.data.status).toBe('scheduled');
        expect(response.data.callbackUrl).toBe('https://yourapp.com/webhooks/sms');
    });

    it('sends a minimal message', async () => {
        const { client, transport } = clientAnswering(jsonResponse(201, { data: messageData() }));

        await client.messages.create({ recipient: PHONE, body: 'Hello!' });

        expect(requestBody(transport.lastRequest)).toEqual({ recipient: PHONE, body: 'Hello!' });
    });

    it('reads what the answer headers report: trace id, request rate limit and daily limit', async () => {
        const { client } = clientAnswering(
            jsonResponse(
                201,
                { data: messageData() },
                {
                    'X-Trace-Id': TRACE_ID,
                    'X-RateLimit-Limit': '240',
                    'X-RateLimit-Remaining': '239',
                    'X-Daily-Limit': '1000',
                    'X-Daily-Remaining': '872',
                },
            ),
        );

        const { responseMeta } = await client.messages.create({ recipient: PHONE, body: 'Hello!' });

        expect(responseMeta).toEqual(
            new ResponseMeta({
                traceId: TRACE_ID,
                rateLimitLimit: 240,
                rateLimitRemaining: 239,
                dailyLimit: 1000,
                dailyRemaining: 872,
            }),
        );
    });

    it('schedules a message at a Date, in Romania time', async () => {
        const { client, transport } = clientAnswering(jsonResponse(201, { data: messageData() }));

        await client.messages.create({ recipient: PHONE, body: 'Later', scheduleAt: new Date('2026-12-24T08:00:00Z') });

        expect(requestBody(transport.lastRequest)).toMatchObject({ schedule_at: '2026-12-24 10:00:00' });
    });

    it('asks for the links to be shortened and reads them', async () => {
        const { client, transport } = clientAnswering(
            jsonResponse(201, {
                data: messageData({
                    body: 'Track it: https://calisero.ro/s/ghJKPV',
                    shortened_urls: [shortenedLinkData({ click_count: 0, last_click: null })],
                }),
            }),
        );

        const { data: message } = await client.messages.create({
            recipient: PHONE,
            body: 'Track it: https://yourstore.com/orders/12345/tracking',
            shortenUrls: true,
        });

        expect(requestBody(transport.lastRequest)).toMatchObject({ shorten_urls: true });
        expect(message.shortenedUrls).toHaveLength(1);
        expect(message.shortenedUrls[0]?.originalLink).toBe('https://yourstore.com/orders/12345/tracking');
        expect(message.shortenedUrls[0]?.shortenedLink).toBe('https://calisero.ro/s/ghJKPV');
    });

    it('rejects with a DailyLimitExceededError once the daily limit is reached', async () => {
        const { client } = clientAnswering(jsonResponse(429, DAILY_LIMIT_BODY, { 'Retry-After': '3600' }));

        const error = await client.messages.create({ recipient: PHONE, body: 'Hello!' }).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(DailyLimitExceededError);
        expect(error).toMatchObject({ dailyLimit: 1000, dailyRemaining: 0, retryAfter: 3600 });
    });

    it('rejects with a ValidationError for a refused recipient', async () => {
        const { client } = clientAnswering(
            jsonResponse(422, {
                message: 'The field recipient (+40742***350) is invalid.',
                errors: { recipient: ['The field recipient (+40742***350) is invalid.'] },
            }),
        );

        await expect(client.messages.create({ recipient: PHONE, body: 'Hello!' })).rejects.toBeInstanceOf(
            ValidationError,
        );
    });

    it('refuses a missing request without sending anything', async () => {
        const { client, transport } = clientAnswering();

        // @ts-expect-error a JavaScript caller may forget the request
        await expect(client.messages.create()).rejects.toThrow('messages.create() needs a request object.');
        expect(transport.requests).toHaveLength(0);
    });

    it('passes the abort signal on', async () => {
        const { client, transport } = clientAnswering(jsonResponse(201, { data: messageData() }));
        const controller = new AbortController();

        await client.messages.create({ recipient: PHONE, body: 'Hello!' }, { signal: controller.signal });

        expect(transport.lastRequest.signal).toBe(controller.signal);
    });
});

describe('MessageService.get()', () => {
    it('retrieves a message by its id', async () => {
        const { client, transport } = clientAnswering(
            jsonResponse(200, { data: messageData({ status: 'delivered' }) }, { 'X-Trace-Id': TRACE_ID }),
        );

        const response = await client.messages.get(MESSAGE_ID);

        expect(transport.lastRequest.method).toBe('GET');
        expect(transport.lastRequest.url).toBe(`${BASE}/messages/${MESSAGE_ID}`);
        expect(response.data.status).toBe('delivered');
        expect(response.responseMeta.traceId).toBe(TRACE_ID);
    });

    it('encodes the id in the path', async () => {
        const { client, transport } = clientAnswering(jsonResponse(200, { data: messageData() }));

        await client.messages.get('../accounts?x=1');

        expect(transport.lastRequest.url).toBe(`${BASE}/messages/..%2Faccounts%3Fx%3D1`);
    });

    it('refuses an empty id without sending anything', async () => {
        const { client, transport } = clientAnswering();

        await expect(client.messages.get('')).rejects.toThrow(
            new TypeError('The message id must be a non-empty string.'),
        );
        await expect(client.messages.get('  ')).rejects.toThrow(TypeError);
        expect(transport.requests).toHaveLength(0);
    });

    it('turns an answer that is not a message into an ApiError', async () => {
        const { client } = clientAnswering(jsonResponse(200, { message: 'OK' }, { 'X-Trace-Id': TRACE_ID }));

        const error = await client.messages.get(MESSAGE_ID).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect(error).toMatchObject({
            message: 'Unexpected API response: Invalid message answer: "data" must be an object, got nothing.',
            statusCode: 200,
            traceId: TRACE_ID,
            errorDetails: { message: 'OK' },
        });
        expect((error as ApiError).cause).toBeInstanceOf(TypeError);
    });
});

describe('MessageService.list()', () => {
    it('lists the first page without a page parameter', async () => {
        const { client, transport } = clientAnswering(
            jsonResponse(200, pageOf([messageData(), messageData({ id: 'second' })], 'messages', 1, true)),
        );

        const page = await client.messages.list();

        expect(transport.lastRequest.url).toBe(`${BASE}/messages`);
        expect(page).toBeInstanceOf(Paginated);
        expect(page.data.map((message) => message.id)).toEqual([MESSAGE_ID, 'second']);
        expect(page.meta.currentPage).toBe(1);
        expect(page.meta.perPage).toBe(50);
        expect(page.hasNextPage).toBe(true);
    });

    it('lists a later page', async () => {
        const { client, transport } = clientAnswering(
            jsonResponse(200, pageOf([messageData()], 'messages', 2)),
            jsonResponse(200, pageOf([messageData()], 'messages', 1)),
        );

        const page = await client.messages.list({ page: 2 });
        await client.messages.list({ page: 1 });

        expect(transport.requests.map((request) => request.url)).toEqual([
            `${BASE}/messages?page=2`,
            `${BASE}/messages`,
        ]);
        expect(page.meta.currentPage).toBe(2);
        expect(page.links.prev).toBe('https://rest.calisero.ro/api/v1/messages?page=1');
    });

    it.each([0, -1, 1.5, Number.NaN])('refuses the page %s', async (page) => {
        const { client, transport } = clientAnswering();

        await expect(client.messages.list({ page })).rejects.toThrow(RangeError);
        expect(transport.requests).toHaveLength(0);
    });
});

describe('MessageService.delete()', () => {
    it('cancels a scheduled message', async () => {
        // The API answers a delete with 200 and an empty JSON array
        const { client, transport } = clientAnswering(jsonResponse(200, []));

        await expect(client.messages.delete(MESSAGE_ID)).resolves.toBeUndefined();

        expect(transport.lastRequest.method).toBe('DELETE');
        expect(transport.lastRequest.url).toBe(`${BASE}/messages/${MESSAGE_ID}`);
        expect(transport.lastRequest.body).toBeNull();
    });

    it('rejects with a ForbiddenError for a message already sent', async () => {
        const { client } = clientAnswering(
            jsonResponse(403, {
                message:
                    'You are not authorized to delete this message or the message has been queued, sent or delivered.',
            }),
        );

        await expect(client.messages.delete(MESSAGE_ID)).rejects.toBeInstanceOf(ForbiddenError);
    });
});
