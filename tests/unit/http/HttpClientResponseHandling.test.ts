import { describe, expect, it } from 'vitest';
import {
    ApiError,
    DailyLimitExceededError,
    ForbiddenError,
    HttpResponse,
    NotFoundError,
    RateLimitedError,
    ServerError,
    TransportError,
    UnauthorizedError,
    ValidationError,
} from '../../../src/index.js';
import { DAILY_LIMIT_BODY, TRACE_ID } from '../../support/fixtures.js';
import { httpClientAnswering, jsonResponse } from '../../support/StubTransport.js';

/**
 * The error a GET answered with `response` rejects with.
 */
async function errorFor(response: HttpResponse | Error): Promise<unknown> {
    const { httpClient } = httpClientAnswering(response);

    return httpClient.get('/messages').then(
        () => {
            throw new Error('The request was expected to fail');
        },
        (error: unknown) => error,
    );
}

describe('HttpClient error answers', () => {
    it('takes the message and the trace id from the error body', async () => {
        const error = await errorFor(jsonResponse(404, { message: 'Resource not found!', trace_id: TRACE_ID }));

        expect(error).toBeInstanceOf(NotFoundError);
        expect(error).toMatchObject({
            message: 'Resource not found!',
            statusCode: 404,
            traceId: TRACE_ID,
            requestId: TRACE_ID,
            errorDetails: { message: 'Resource not found!', trace_id: TRACE_ID },
        });
    });

    it('reads the trace id header whatever its spelling, before the body', async () => {
        for (const name of ['X-Trace-Id', 'x-trace-id', 'X-TRACE-ID']) {
            const error = await errorFor(
                jsonResponse(401, { message: 'Unauthenticated.', trace_id: 'from-body' }, { [name]: TRACE_ID }),
            );

            expect(error).toBeInstanceOf(UnauthorizedError);
            expect((error as UnauthorizedError).traceId).toBe(TRACE_ID);
        }
    });

    it('still reads an X-Request-ID header without a trace id', async () => {
        const error = await errorFor(new HttpResponse(404, { 'X-Request-ID': 'req_123' }, ''));

        expect((error as ApiError).traceId).toBe('req_123');
    });

    it('gives an error without a JSON body a generic message', async () => {
        const error = await errorFor(
            new HttpResponse(502, { 'Content-Type': 'text/html' }, '<html>Bad Gateway</html>'),
        );

        expect(error).toBeInstanceOf(ServerError);
        expect(error).toMatchObject({ message: 'HTTP error 502', statusCode: 502, traceId: null, errorDetails: {} });
    });

    it('ignores an error body that is JSON but not an object', async () => {
        const error = await errorFor(new HttpResponse(500, {}, '["Server Error"]'));

        expect(error).toMatchObject({ message: 'HTTP error 500', errorDetails: {} });
    });

    it('reads the message from error.message when there is no message', async () => {
        const error = await errorFor(jsonResponse(400, { error: { message: 'Bad request body' } }));

        expect((error as ApiError).message).toBe('Bad request body');
    });

    it('gives an empty message a generic one', async () => {
        const error = await errorFor(jsonResponse(403, { message: '' }));

        expect(error).toBeInstanceOf(ForbiddenError);
        expect((error as ApiError).message).toBe('HTTP error 403');
    });

    it.each([
        [401, UnauthorizedError],
        [403, ForbiddenError],
        [404, NotFoundError],
        [422, ValidationError],
        [429, RateLimitedError],
        [500, ServerError],
        [502, ServerError],
        [503, ServerError],
        [504, ServerError],
    ])('maps %i to %o', async (status, ErrorClass) => {
        const error = await errorFor(jsonResponse(status, { message: `Status ${status}` }));

        expect(error).toBeInstanceOf(ErrorClass);
        expect((error as ApiError).statusCode).toBe(status);
        expect((error as ApiError).message).toBe(`Status ${status}`);
    });

    it.each([302, 400, 405, 409, 418, 501])('maps %i to a plain ApiError', async (status) => {
        const error = await errorFor(jsonResponse(status, { message: 'Refused' }));

        expect((error as ApiError).constructor).toBe(ApiError);
        expect((error as ApiError).statusCode).toBe(status);
    });
});

describe('HttpClient validation errors (422)', () => {
    it('reads the field errors', async () => {
        const error = await errorFor(
            jsonResponse(
                422,
                {
                    message: 'The recipient field is required. (and 1 more error)',
                    errors: {
                        recipient: ['The recipient field is required.'],
                        body: ['The body field is required.'],
                    },
                    trace_id: TRACE_ID,
                },
                { 'X-Trace-Id': TRACE_ID },
            ),
        );

        expect(error).toBeInstanceOf(ValidationError);
        expect(error).toMatchObject({
            message: 'The recipient field is required. (and 1 more error)',
            traceId: TRACE_ID,
            validationErrors: {
                recipient: ['The recipient field is required.'],
                body: ['The body field is required.'],
            },
        });
    });

    it('reads the duplicate message guard', async () => {
        const error = await errorFor(
            jsonResponse(422, {
                message: 'Duplicate SMS request detected.',
                errors: {
                    duplicate_sms: [
                        'A similar SMS message has been recently submitted. Please wait a moment before trying again.',
                    ],
                },
            }),
        );

        expect(Object.keys((error as ValidationError).validationErrors)).toEqual(['duplicate_sms']);
    });

    it('reads validation_errors when there are no errors', async () => {
        const error = await errorFor(
            jsonResponse(422, { message: 'Invalid.', validation_errors: { code: ['Wrong code.'] } }),
        );

        expect((error as ValidationError).validationErrors).toEqual({ code: ['Wrong code.'] });
    });

    it('has no field errors when the body carries none', async () => {
        // The API's own 422s carry field errors; a body without them must not pass for them
        const error = await errorFor(
            jsonResponse(422, { message: 'The request could not be processed.', trace_id: TRACE_ID }),
        );

        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).validationErrors).toEqual({});
        expect((error as ValidationError).errorDetails.trace_id).toBe(TRACE_ID);
    });

    it('turns a single message into a list and drops what is not text', async () => {
        const error = await errorFor(
            jsonResponse(422, {
                message: 'Invalid.',
                errors: { phone: 'Invalid phone.', code: ['Wrong.', 42, null], body: 42, sender: { nested: true } },
            }),
        );

        expect((error as ValidationError).validationErrors).toEqual({ phone: ['Invalid phone.'], code: ['Wrong.'] });
    });
});

describe('HttpClient rate limits (429)', () => {
    it('reads a refusal of the request rate limit', async () => {
        // Lowercase names, as HTTP/2 sends them
        const error = await errorFor(
            jsonResponse(
                429,
                { message: 'Too Many Attempts.', trace_id: TRACE_ID },
                {
                    'retry-after': '17',
                    'x-ratelimit-limit': '240',
                    'x-ratelimit-remaining': '0',
                    'x-ratelimit-reset': '1790000000',
                    'x-trace-id': TRACE_ID,
                },
            ),
        );

        expect(error).toBeInstanceOf(RateLimitedError);
        expect(error).not.toBeInstanceOf(DailyLimitExceededError);
        expect(error).toMatchObject({
            message: 'Too Many Attempts.',
            statusCode: 429,
            traceId: TRACE_ID,
            retryAfter: 17,
            rateLimitLimit: 240,
            rateLimitRemaining: 0,
            rateLimitReset: 1790000000,
        });
    });

    it('reads a refusal of the daily sending limit', async () => {
        // Mixed-case names, as HTTP/1.1 sends them
        const error = await errorFor(
            jsonResponse(429, DAILY_LIMIT_BODY, {
                'Retry-After': '21600',
                'X-Daily-Limit': '1000',
                'X-Daily-Remaining': '0',
                'X-RateLimit-Limit': '240',
                'X-RateLimit-Remaining': '238',
                'X-Trace-Id': TRACE_ID,
            }),
        );

        // Code written against RateLimitedError keeps catching it
        expect(error).toBeInstanceOf(RateLimitedError);
        expect(error).toBeInstanceOf(DailyLimitExceededError);
        expect(error).toMatchObject({
            message: DAILY_LIMIT_BODY.message,
            statusCode: 429,
            traceId: TRACE_ID,
            dailyLimit: 1000,
            dailyRemaining: 0,
            resetsAt: '2026-10-01T00:00:00+03:00',
            retryAfter: 21600,
            rateLimitLimit: 240,
            rateLimitRemaining: 238,
            rateLimitReset: null,
        });
        expect((error as DailyLimitExceededError).errorDetails.code).toBe('daily_limit_exceeded');
    });

    it('falls back to the headers for what the daily limit body lacks', async () => {
        const error = await errorFor(
            jsonResponse(
                429,
                { message: 'Daily limit reached.', code: 'daily_limit_exceeded' },
                { 'X-Daily-Limit': '500', 'X-Daily-Remaining': '0' },
            ),
        );

        expect(error).toMatchObject({ dailyLimit: 500, dailyRemaining: 0, resetsAt: null, retryAfter: null });
    });

    it('ignores rate limit headers that are not whole seconds', async () => {
        const error = await errorFor(
            jsonResponse(
                429,
                { message: 'Too Many Attempts.' },
                { 'Retry-After': 'Wed, 21 Oct 2026 07:28:00 GMT', 'X-RateLimit-Limit': '-1' },
            ),
        );

        expect(error).toMatchObject({ retryAfter: null, rateLimitLimit: null });
    });
});

describe('HttpClient requests without an answer', () => {
    it('throws a TransportError that keeps the cause', async () => {
        const cause = new TypeError('fetch failed');
        const error = await errorFor(cause);

        expect(error).toBeInstanceOf(TransportError);
        expect(error).toMatchObject({ message: 'HTTP request failed: fetch failed', statusCode: null, traceId: null });
        expect((error as TransportError).cause).toBe(cause);
    });

    it('describes a failure that is not an Error', async () => {
        const { httpClient, transport } = httpClientAnswering();
        transport.send = () => Promise.reject('socket closed');

        await expect(httpClient.get('/messages')).rejects.toThrow('HTTP request failed: socket closed');
    });
});
