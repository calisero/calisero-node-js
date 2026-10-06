import type { HttpRequest } from '../http/HttpRequest.js';
import type { HttpResponse } from '../http/HttpResponse.js';

/**
 * Sends a request and returns the API's answer, whatever its status.
 *
 * It throws only when the request got no answer (network error, timeout, abort):
 * the client turns that into a {@link TransportError}. The default transport is
 * {@link FetchTransport}; a stub transport lets tests run without the network.
 */
export interface Transport {
    send(request: HttpRequest): Promise<HttpResponse>;
}
