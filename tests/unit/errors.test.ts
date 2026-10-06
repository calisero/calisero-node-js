import { describe, expect, it } from 'vitest';
import {
    ApiError,
    DailyLimitExceededError,
    ForbiddenError,
    InvalidWebhookPayloadError,
    NotFoundError,
    RateLimitedError,
    ServerError,
    TransportError,
    UnauthorizedError,
    ValidationError,
} from '../../src/index.js';
import { TRACE_ID } from '../support/fixtures.js';

const apiErrors = [
    ['UnauthorizedError', UnauthorizedError],
    ['ForbiddenError', ForbiddenError],
    ['NotFoundError', NotFoundError],
    ['ValidationError', ValidationError],
    ['RateLimitedError', RateLimitedError],
    ['DailyLimitExceededError', DailyLimitExceededError],
    ['ServerError', ServerError],
    ['TransportError', TransportError],
] as const;

describe('errors', () => {
    it.each(apiErrors)('%s is an ApiError named after its class', (name, ErrorClass) => {
        const error = new ErrorClass('Something failed');

        expect(error).toBeInstanceOf(ApiError);
        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe(name);
        expect(String(error)).toBe(`${name}: Something failed`);
        expect(error.stack?.startsWith(`${name}: Something failed`)).toBe(true);
    });

    it('ApiError carries the status, the trace id and the error body', () => {
        const error = new ApiError('Resource not found!', {
            statusCode: 404,
            traceId: TRACE_ID,
            errorDetails: { message: 'Resource not found!', trace_id: TRACE_ID },
        });

        expect(error.name).toBe('ApiError');
        expect(error.message).toBe('Resource not found!');
        expect(error.statusCode).toBe(404);
        expect(error.traceId).toBe(TRACE_ID);
        expect(error.requestId).toBe(TRACE_ID);
        expect(error.errorDetails).toEqual({ message: 'Resource not found!', trace_id: TRACE_ID });
    });

    it('ApiError defaults to no status, trace id, body or cause', () => {
        const error = new ApiError();

        expect(error.message).toBe('');
        expect(error.statusCode).toBeNull();
        expect(error.traceId).toBeNull();
        expect(error.requestId).toBeNull();
        expect(error.errorDetails).toEqual({});
        expect('cause' in error).toBe(false);
    });

    it('keeps the cause', () => {
        const cause = new Error('socket hang up');

        expect(new TransportError('HTTP request failed: socket hang up', { cause }).cause).toBe(cause);
    });

    it('ValidationError carries the field errors', () => {
        const error = new ValidationError('The recipient field is required.', {
            statusCode: 422,
            validationErrors: { recipient: ['The recipient field is required.'] },
        });

        expect(error.validationErrors).toEqual({ recipient: ['The recipient field is required.'] });
        expect(new ValidationError('x').validationErrors).toEqual({});
    });

    it('RateLimitedError carries the request rate limit', () => {
        const error = new RateLimitedError('Too Many Attempts.', {
            statusCode: 429,
            retryAfter: 17,
            rateLimitLimit: 240,
            rateLimitRemaining: 0,
            rateLimitReset: 1790000000,
        });

        expect(error.retryAfter).toBe(17);
        expect(error.rateLimitLimit).toBe(240);
        expect(error.rateLimitRemaining).toBe(0);
        expect(error.rateLimitReset).toBe(1790000000);

        const bare = new RateLimitedError('Too Many Attempts.');

        expect([bare.retryAfter, bare.rateLimitLimit, bare.rateLimitRemaining, bare.rateLimitReset]).toEqual([
            null,
            null,
            null,
            null,
        ]);
    });

    it('DailyLimitExceededError is a RateLimitedError carrying the daily limit', () => {
        const error = new DailyLimitExceededError('Daily limit reached.', {
            statusCode: 429,
            retryAfter: 21600,
            dailyLimit: 1000,
            dailyRemaining: 0,
            resetsAt: '2026-10-01T00:00:00+03:00',
        });

        expect(error).toBeInstanceOf(RateLimitedError);
        expect(error.dailyLimit).toBe(1000);
        expect(error.dailyRemaining).toBe(0);
        expect(error.resetsAt).toBe('2026-10-01T00:00:00+03:00');
        expect(error.retryAfter).toBe(21600);
        expect(DailyLimitExceededError.ERROR_CODE).toBe('daily_limit_exceeded');

        const bare = new DailyLimitExceededError();

        expect([bare.dailyLimit, bare.dailyRemaining, bare.resetsAt]).toEqual([null, null, null]);
    });

    it('a RateLimitedError is not a DailyLimitExceededError', () => {
        expect(new RateLimitedError('Too Many Attempts.')).not.toBeInstanceOf(DailyLimitExceededError);
    });

    it('InvalidWebhookPayloadError is not an ApiError', () => {
        const error = new InvalidWebhookPayloadError('Invalid delivery webhook payload: expected an object.');

        expect(error).toBeInstanceOf(Error);
        expect(error).not.toBeInstanceOf(ApiError);
        expect(error.name).toBe('InvalidWebhookPayloadError');
    });
});
