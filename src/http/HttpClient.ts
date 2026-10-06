import type { AuthProvider } from '../contracts/AuthProvider.js';
import type { Transport } from '../contracts/Transport.js';
import {
    ApiError,
    DailyLimitExceededError,
    ForbiddenError,
    NotFoundError,
    RateLimitedError,
    ServerError,
    TransportError,
    UnauthorizedError,
    ValidationError,
    type ValidationErrors,
} from '../errors.js';
import { isJsonObject, type JsonObject } from '../internal/json.js';
import { FetchTransport } from './FetchTransport.js';
import type { HttpMethod, HttpRequest } from './HttpRequest.js';
import type { HttpResponse } from './HttpResponse.js';
import { readHeaderInt, readHeaderString } from './headers.js';
import { type AppInfo, buildUserAgent } from './userAgent.js';

/**
 * The production API.
 */
export const DEFAULT_BASE_URL = 'https://rest.calisero.ro/api/v1';

export type QueryParams = Readonly<Record<string, string | number | boolean | null | undefined>>;

export interface HttpClientOptions {
    /**
     * Provides the API key, e.g. a {@link BearerTokenAuthProvider}.
     */
    readonly authProvider: AuthProvider;

    /**
     * Sends the requests: a {@link FetchTransport} with its default timeout when omitted.
     */
    readonly transport?: Transport | undefined;

    /**
     * The API's base URL: {@link DEFAULT_BASE_URL} when omitted.
     */
    readonly baseUrl?: string | undefined;

    /**
     * Your application, named in the User-Agent header after the library.
     */
    readonly appInfo?: AppInfo | null | undefined;
}

export interface RequestOptions {
    /**
     * Cancels the request when aborted; the call then rejects with a {@link TransportError}.
     */
    readonly signal?: AbortSignal | undefined;
}

/**
 * A successful answer.
 */
export interface HttpResult {
    /**
     * The decoded JSON body; null when the answer had no body.
     */
    readonly body: unknown;

    /**
     * The raw answer, headers included.
     */
    readonly response: HttpResponse;
}

/**
 * Sends authenticated JSON requests to the API through a {@link Transport} and
 * turns error answers into the matching {@link ApiError}.
 *
 * It never retries: the API takes no idempotency key, so a create retried after a
 * timeout or a server error could send the message twice.
 */
export class HttpClient {
    /**
     * The base URL every path is appended to, without a trailing slash.
     */
    readonly baseUrl: string;

    /**
     * The User-Agent header of every request, e.g.
     * `Calisero-SMS-Node/1.0.0 (Node.js v24.21.0; linux x64)`, then your application.
     */
    readonly userAgent: string;

    readonly #transport: Transport;
    readonly #authProvider: AuthProvider;
    #lastResponse: HttpResponse | null = null;

    /**
     * @throws {TypeError} when `appInfo` has no usable name
     */
    constructor(options: HttpClientOptions) {
        this.#authProvider = options.authProvider;
        this.#transport = options.transport ?? new FetchTransport();
        this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
        this.userAgent = buildUserAgent(options.appInfo);
    }

    /**
     * The raw answer to the last request, headers included: null before the first
     * request and after a request that got no answer.
     *
     * With concurrent requests on the same client it is the answer that arrived
     * last; each call's own answer is in its result.
     */
    get lastResponse(): HttpResponse | null {
        return this.#lastResponse;
    }

    async get(path: string, query: QueryParams = {}, options: RequestOptions = {}): Promise<HttpResult> {
        return this.send('GET', this.buildUrl(path, query), null, options);
    }

    async post(path: string, data: JsonObject = {}, options: RequestOptions = {}): Promise<HttpResult> {
        return this.send('POST', this.buildUrl(path), data, options);
    }

    async put(path: string, data: JsonObject = {}, options: RequestOptions = {}): Promise<HttpResult> {
        return this.send('PUT', this.buildUrl(path), data, options);
    }

    async delete(path: string, options: RequestOptions = {}): Promise<HttpResult> {
        return this.send('DELETE', this.buildUrl(path), null, options);
    }

    private buildUrl(path: string, query: QueryParams = {}): string {
        const url = `${this.baseUrl}/${path.replace(/^\/+/, '')}`;
        const params = new URLSearchParams();

        for (const [name, value] of Object.entries(query)) {
            if (value !== null && value !== undefined) {
                params.append(name, String(value));
            }
        }

        const queryString = params.toString();

        return queryString === '' ? url : `${url}?${queryString}`;
    }

    private async send(
        method: HttpMethod,
        url: string,
        data: JsonObject | null,
        options: RequestOptions,
    ): Promise<HttpResult> {
        const request: HttpRequest = {
            method,
            url,
            headers: {
                // Without it the API answers a missing or invalid key with a redirect, not a 401
                Accept: 'application/json',
                'Content-Type': 'application/json',
                // Names the library, its version and the runtime, so the platform can tell its requests apart
                'User-Agent': this.userAgent,
                Authorization: `Bearer ${await this.#authProvider.getToken()}`,
            },
            body: data !== null && Object.keys(data).length > 0 ? JSON.stringify(data) : null,
            signal: options.signal,
        };

        this.#lastResponse = null;

        let response: HttpResponse;

        try {
            response = await this.#transport.send(request);
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);

            throw new TransportError(`HTTP request failed: ${reason}`, { cause: error });
        }

        this.#lastResponse = response;

        return { body: handleResponse(response), response };
    }
}

/**
 * The decoded body of a successful answer, or the error of a failed one.
 */
function handleResponse(response: HttpResponse): unknown {
    const { status, body } = response;

    if (status >= 200 && status < 300) {
        if (body.trim() === '') {
            return null;
        }

        try {
            return JSON.parse(body) as unknown;
        } catch (error) {
            throw new ApiError(`Failed to decode JSON response: ${(error as Error).message}`, {
                statusCode: status,
                traceId: traceId(response, {}),
                cause: error,
            });
        }
    }

    const errorDetails = decodeErrorBody(body);
    const message = errorMessage(errorDetails) ?? `HTTP error ${status}`;
    const options = { statusCode: status, traceId: traceId(response, errorDetails), errorDetails };

    switch (status) {
        case 401:
            throw new UnauthorizedError(message, options);
        case 403:
            throw new ForbiddenError(message, options);
        case 404:
            throw new NotFoundError(message, options);
        case 422:
            throw new ValidationError(message, { ...options, validationErrors: validationErrors(errorDetails) });
        case 429:
            throw rateLimitError(response, message, options);
        case 500:
        case 502:
        case 503:
        case 504:
            throw new ServerError(message, options);
        default:
            throw new ApiError(message, options);
    }
}

/**
 * The JSON body of an error answer; empty when it has none.
 */
function decodeErrorBody(body: string): JsonObject {
    try {
        const decoded: unknown = JSON.parse(body);

        return isJsonObject(decoded) ? decoded : {};
    } catch {
        // An error page from a proxy, or no body at all
        return {};
    }
}

/**
 * The API sends the error's description as `message`; `error.message` is also read.
 */
function errorMessage(errorDetails: JsonObject): string | null {
    const { message, error } = errorDetails;

    if (typeof message === 'string' && message !== '') {
        return message;
    }

    if (isJsonObject(error) && typeof error.message === 'string' && error.message !== '') {
        return error.message;
    }

    return null;
}

/**
 * The request's trace id: the X-Trace-Id header the API sends with every answer,
 * else the trace_id of the error body, else an X-Request-ID header.
 */
function traceId(response: HttpResponse, errorDetails: JsonObject): string | null {
    const fromHeader = readHeaderString(response, 'X-Trace-Id');

    if (fromHeader !== null) {
        return fromHeader;
    }

    const fromBody = errorDetails.trace_id;

    if (typeof fromBody === 'string' && fromBody !== '') {
        return fromBody;
    }

    return readHeaderString(response, 'X-Request-ID');
}

/**
 * The field errors of a 422 body (`errors`, or `validation_errors`); empty when
 * it carries none.
 */
function validationErrors(errorDetails: JsonObject): ValidationErrors {
    let errors: JsonObject = {};

    if (isJsonObject(errorDetails.errors)) {
        errors = errorDetails.errors;
    } else if (isJsonObject(errorDetails.validation_errors)) {
        errors = errorDetails.validation_errors;
    }

    const result: Record<string, string[]> = {};

    for (const [field, messages] of Object.entries(errors)) {
        if (typeof messages === 'string') {
            result[field] = [messages];
        } else if (Array.isArray(messages)) {
            result[field] = messages.filter((message): message is string => typeof message === 'string');
        }
    }

    return result;
}

/**
 * A 429 comes from one of two limits, told apart by the body's code: the
 * account's daily sending limit (daily_limit_exceeded) or the request rate limit.
 */
function rateLimitError(
    response: HttpResponse,
    message: string,
    options: { statusCode: number; traceId: string | null; errorDetails: JsonObject },
): RateLimitedError {
    const rateLimit = {
        ...options,
        retryAfter: readHeaderInt(response, 'Retry-After'),
        rateLimitLimit: readHeaderInt(response, 'X-RateLimit-Limit'),
        rateLimitRemaining: readHeaderInt(response, 'X-RateLimit-Remaining'),
        rateLimitReset: readHeaderInt(response, 'X-RateLimit-Reset'),
    };
    const { errorDetails } = options;

    if (errorDetails.code !== DailyLimitExceededError.ERROR_CODE) {
        return new RateLimitedError(message, rateLimit);
    }

    return new DailyLimitExceededError(message, {
        ...rateLimit,
        dailyLimit: integerField(errorDetails, 'daily_limit') ?? readHeaderInt(response, 'X-Daily-Limit'),
        dailyRemaining: integerField(errorDetails, 'daily_remaining') ?? readHeaderInt(response, 'X-Daily-Remaining'),
        resetsAt: typeof errorDetails.resets_at === 'string' ? errorDetails.resets_at : null,
    });
}

function integerField(data: JsonObject, key: string): number | null {
    const value = data[key];

    return Number.isSafeInteger(value) ? (value as number) : null;
}
