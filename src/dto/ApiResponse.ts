import { ResponseMeta } from './ResponseMeta.js';

/**
 * A single resource as the API answers it: the resource (`data`) and what the
 * answer's headers report (`responseMeta`).
 */
export class ApiResponse<T> {
    readonly data: T;

    /**
     * The answer's headers: trace id, request rate limit and, for a created message
     * or verification, what is left of the account's daily sending limit.
     */
    readonly responseMeta: ResponseMeta;

    constructor(data: T, responseMeta = new ResponseMeta()) {
        this.data = data;
        this.responseMeta = responseMeta;
    }
}
