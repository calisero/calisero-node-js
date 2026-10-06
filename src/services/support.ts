import { ApiResponse } from '../dto/ApiResponse.js';
import { Paginated } from '../dto/Pagination.js';
import { ResponseMeta } from '../dto/ResponseMeta.js';
import { ApiError } from '../errors.js';
import type { HttpResult } from '../http/HttpClient.js';
import { readHeaderString } from '../http/headers.js';
import { FieldReader } from '../internal/FieldReader.js';
import { isJsonObject } from '../internal/json.js';

/**
 * Reads a DTO out of a decoded JSON value, naming it `context` in errors.
 */
export type ItemReader<T> = (data: unknown, context: string) => T;

/**
 * The options of the calls that list resources.
 */
export interface PageOptions {
    /**
     * The page to read, from 1; each page holds 50 items.
     */
    readonly page?: number | undefined;
}

/**
 * An answer holding one resource as `data`.
 *
 * @internal
 */
export function single<T>(result: HttpResult, item: ItemReader<T>, context: string): ApiResponse<T> {
    return parse(result, (body) => {
        const data = FieldReader.of(body, `${context} answer`).object('data');

        return new ApiResponse(item(data, context), ResponseMeta.fromResponse(result.response));
    });
}

/**
 * An answer holding a page of resources.
 *
 * @internal
 */
export function page<T>(result: HttpResult, item: ItemReader<T>): Paginated<T> {
    return parse(result, () => Paginated.fromResult(result, item));
}

/**
 * The query of a list call: the page, sent only from the second one on.
 *
 * @internal
 */
export function pageQuery(options: PageOptions): Record<string, number> {
    const { page } = options;

    if (page === undefined || page === null) {
        return {};
    }

    if (!Number.isSafeInteger(page) || page < 1) {
        throw new RangeError(`The page must be a positive integer, got ${String(page)}.`);
    }

    return page > 1 ? { page } : {};
}

/**
 * An id in a request path: refused when empty, which would change the request's
 * meaning (`DELETE /messages/` instead of `DELETE /messages/{id}`), and encoded.
 *
 * @internal
 */
export function pathId(id: string, name: string): string {
    if (typeof id !== 'string' || id.trim() === '') {
        throw new TypeError(`The ${name} must be a non-empty string.`);
    }

    return encodeURIComponent(id);
}

/**
 * The request object a call takes, refused when missing.
 *
 * @internal
 */
export function requestObject<T extends object>(request: T, call: string): T {
    if (!isJsonObject(request)) {
        throw new TypeError(`${call} needs a request object.`);
    }

    return request;
}

/**
 * Reads the DTOs out of an answer. An answer that is not what the API documents
 * becomes an ApiError carrying its status, trace id and body.
 */
function parse<T>(result: HttpResult, read: (body: unknown) => T): T {
    try {
        return read(result.body);
    } catch (error) {
        if (!(error instanceof TypeError)) {
            throw error;
        }

        throw new ApiError(`Unexpected API response: ${error.message}`, {
            statusCode: result.response.status,
            traceId: readHeaderString(result.response, 'X-Trace-Id'),
            errorDetails: isJsonObject(result.body) ? result.body : {},
            cause: error,
        });
    }
}
