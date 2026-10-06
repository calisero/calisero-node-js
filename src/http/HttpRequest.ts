export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * A request to the API, as handed to the {@link Transport}.
 */
export interface HttpRequest {
    readonly method: HttpMethod;

    /**
     * The full URL, query string included.
     */
    readonly url: string;

    readonly headers: Readonly<Record<string, string>>;

    /**
     * The JSON body; null when the request has none.
     */
    readonly body: string | null;

    /**
     * Aborts the request when it is aborted.
     */
    readonly signal?: AbortSignal | undefined;
}
