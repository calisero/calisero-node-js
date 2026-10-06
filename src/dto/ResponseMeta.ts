import type { HttpResponse } from '../http/HttpResponse.js';
import { readHeaderInt, readHeaderString } from '../http/headers.js';

/**
 * What the API reports in the headers of an answer: the request's trace id, the
 * request rate limit and, for a created message or verification, the account's
 * daily sending limit. A value is null when the answer did not carry it.
 */
export class ResponseMeta {
    /**
     * The request's trace id (X-Trace-Id): quote it to Calisero support, or look the
     * request up in the dashboard under Developers → Debug.
     */
    readonly traceId: string | null;

    /**
     * How many requests the API user may make a minute (X-RateLimit-Limit).
     */
    readonly rateLimitLimit: number | null;

    /**
     * How many requests the API user may still make this minute (X-RateLimit-Remaining).
     */
    readonly rateLimitRemaining: number | null;

    /**
     * How many messages the account can send in a day (X-Daily-Limit); null when
     * no daily limit applies or the answer is not to a created message or verification.
     */
    readonly dailyLimit: number | null;

    /**
     * How many messages the account can still send today, after this one
     * (X-Daily-Remaining); null when no daily limit applies.
     */
    readonly dailyRemaining: number | null;

    constructor(props: Partial<ResponseMetaProps> = {}) {
        this.traceId = props.traceId ?? null;
        this.rateLimitLimit = props.rateLimitLimit ?? null;
        this.rateLimitRemaining = props.rateLimitRemaining ?? null;
        this.dailyLimit = props.dailyLimit ?? null;
        this.dailyRemaining = props.dailyRemaining ?? null;
    }

    /**
     * Read the headers of an answer; every value is null when there is no answer.
     */
    static fromResponse(response: HttpResponse | null | undefined): ResponseMeta {
        if (!response) {
            return new ResponseMeta();
        }

        return new ResponseMeta({
            traceId: readHeaderString(response, 'X-Trace-Id'),
            rateLimitLimit: readHeaderInt(response, 'X-RateLimit-Limit'),
            rateLimitRemaining: readHeaderInt(response, 'X-RateLimit-Remaining'),
            dailyLimit: readHeaderInt(response, 'X-Daily-Limit'),
            dailyRemaining: readHeaderInt(response, 'X-Daily-Remaining'),
        });
    }
}

export interface ResponseMetaProps {
    readonly traceId: string | null;
    readonly rateLimitLimit: number | null;
    readonly rateLimitRemaining: number | null;
    readonly dailyLimit: number | null;
    readonly dailyRemaining: number | null;
}
