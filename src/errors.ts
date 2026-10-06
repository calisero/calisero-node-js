import type { JsonObject } from './internal/json.js';

export interface ApiErrorOptions {
    /** The HTTP status of the answer; null when there was none. */
    readonly statusCode?: number | null | undefined;
    /** The request's trace id. */
    readonly traceId?: string | null | undefined;
    /** The decoded error body. */
    readonly errorDetails?: JsonObject | undefined;
    /** The error that caused this one. */
    readonly cause?: unknown;
}

/**
 * Base error for all Calisero API related errors.
 */
export class ApiError extends Error {
    static {
        // On the prototype rather than the instance, so the stack trace already names the class
        ApiError.prototype.name = 'ApiError';
    }

    /**
     * The HTTP status of the answer; null when the request got no answer.
     */
    readonly statusCode: number | null;

    /**
     * The request's trace id, from the X-Trace-Id header or the error body's
     * trace_id: quote it to Calisero support, or look the request up in the
     * dashboard under Developers → Debug.
     */
    readonly traceId: string | null;

    /**
     * The decoded error body; empty when the answer had none.
     */
    readonly errorDetails: JsonObject;

    constructor(message = '', options: ApiErrorOptions = {}) {
        super(message, 'cause' in options ? { cause: options.cause } : undefined);
        this.statusCode = options.statusCode ?? null;
        this.traceId = options.traceId ?? null;
        this.errorDetails = options.errorDetails ?? {};
    }

    /**
     * The request's trace id, the same as {@link traceId}.
     */
    get requestId(): string | null {
        return this.traceId;
    }
}

/**
 * Thrown when authentication fails (401): the API key is missing, invalid or revoked.
 */
export class UnauthorizedError extends ApiError {
    static {
        UnauthorizedError.prototype.name = 'UnauthorizedError';
    }
}

/**
 * Thrown when access is forbidden (403), e.g. deleting a message already sent.
 */
export class ForbiddenError extends ApiError {
    static {
        ForbiddenError.prototype.name = 'ForbiddenError';
    }
}

/**
 * Thrown when a resource is not found (404).
 */
export class NotFoundError extends ApiError {
    static {
        NotFoundError.prototype.name = 'NotFoundError';
    }
}

/**
 * The field errors of a 422 answer: field name → messages.
 */
export type ValidationErrors = Readonly<Record<string, readonly string[]>>;

export interface ValidationErrorOptions extends ApiErrorOptions {
    readonly validationErrors?: ValidationErrors | undefined;
}

/**
 * Thrown for validation errors (422): the request's data was refused.
 */
export class ValidationError extends ApiError {
    static {
        ValidationError.prototype.name = 'ValidationError';
    }

    /**
     * The field errors, e.g. `{ recipient: ['The recipient field is required.'] }`;
     * empty when the answer carried none.
     */
    readonly validationErrors: ValidationErrors;

    constructor(message = '', options: ValidationErrorOptions = {}) {
        super(message, options);
        this.validationErrors = options.validationErrors ?? {};
    }
}

export interface RateLimitedErrorOptions extends ApiErrorOptions {
    readonly retryAfter?: number | null | undefined;
    readonly rateLimitLimit?: number | null | undefined;
    readonly rateLimitRemaining?: number | null | undefined;
    readonly rateLimitReset?: number | null | undefined;
}

/**
 * Thrown when the request rate limit is exceeded (429).
 *
 * This is the request rate limit (each API user may make 240 requests a minute);
 * a refusal of the account's daily sending limit is thrown as the subclass
 * {@link DailyLimitExceededError}.
 */
export class RateLimitedError extends ApiError {
    static {
        RateLimitedError.prototype.name = 'RateLimitedError';
    }

    /**
     * Seconds to wait before sending again (the Retry-After header).
     */
    readonly retryAfter: number | null;

    /**
     * How many requests the API user may make a minute (the X-RateLimit-Limit header).
     */
    readonly rateLimitLimit: number | null;

    /**
     * How many requests the API user may still make this minute (the
     * X-RateLimit-Remaining header): 0 when the request rate limit refused the request.
     */
    readonly rateLimitRemaining: number | null;

    /**
     * When requests are accepted again, as a Unix timestamp (the X-RateLimit-Reset
     * header); sent only when the request rate limit refused the request.
     */
    readonly rateLimitReset: number | null;

    constructor(message = '', options: RateLimitedErrorOptions = {}) {
        super(message, options);
        this.retryAfter = options.retryAfter ?? null;
        this.rateLimitLimit = options.rateLimitLimit ?? null;
        this.rateLimitRemaining = options.rateLimitRemaining ?? null;
        this.rateLimitReset = options.rateLimitReset ?? null;
    }
}

export interface DailyLimitExceededErrorOptions extends RateLimitedErrorOptions {
    readonly dailyLimit?: number | null | undefined;
    readonly dailyRemaining?: number | null | undefined;
    readonly resetsAt?: string | null | undefined;
}

/**
 * Thrown when the account reached its daily sending limit (429 with the code
 * `daily_limit_exceeded`): nothing was sent and nothing was billed.
 *
 * The limit resets at midnight, Romania time ({@link resetsAt}); test messages
 * never count towards it. It extends {@link RateLimitedError}, so code that
 * catches that one keeps catching this refusal too.
 */
export class DailyLimitExceededError extends RateLimitedError {
    static {
        DailyLimitExceededError.prototype.name = 'DailyLimitExceededError';
    }

    /**
     * The `code` of the error body that tells this refusal from the request rate limit's.
     */
    static readonly ERROR_CODE = 'daily_limit_exceeded';

    /**
     * How many messages the account can send in a day.
     */
    readonly dailyLimit: number | null;

    /**
     * How many messages the account can still send today: 0 once the limit is reached.
     */
    readonly dailyRemaining: number | null;

    /**
     * The next midnight, Romania time, when the account can send again, as an
     * ISO 8601 date-time (e.g. 2026-10-01T00:00:00+03:00).
     */
    readonly resetsAt: string | null;

    constructor(message = '', options: DailyLimitExceededErrorOptions = {}) {
        super(message, options);
        this.dailyLimit = options.dailyLimit ?? null;
        this.dailyRemaining = options.dailyRemaining ?? null;
        this.resetsAt = options.resetsAt ?? null;
    }
}

/**
 * Thrown for server errors (500, 502, 503, 504).
 */
export class ServerError extends ApiError {
    static {
        ServerError.prototype.name = 'ServerError';
    }
}

/**
 * Thrown when the request got no answer: network error, timeout or abort. The
 * original error is its `cause`.
 */
export class TransportError extends ApiError {
    static {
        TransportError.prototype.name = 'TransportError';
    }
}

/**
 * Thrown when a delivery status callback is not the payload Calisero sends: not
 * JSON, not an object, or a required field missing or malformed.
 */
export class InvalidWebhookPayloadError extends Error {
    static {
        InvalidWebhookPayloadError.prototype.name = 'InvalidWebhookPayloadError';
    }
}
