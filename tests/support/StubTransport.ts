import { HttpClient, type HttpRequest, HttpResponse, SmsClient, type Transport } from '../../src/index.js';

/**
 * An answer of the stub: a response, or the error of a request that got none.
 */
export type StubAnswer = HttpResponse | Error;

/**
 * A transport that records its requests and gives the queued answers in turn.
 */
export class StubTransport implements Transport {
    readonly requests: HttpRequest[] = [];
    readonly #answers: StubAnswer[];

    constructor(...answers: StubAnswer[]) {
        this.#answers = answers;
    }

    get lastRequest(): HttpRequest {
        const request = this.requests.at(-1);

        if (request === undefined) {
            throw new Error('StubTransport: no request was sent');
        }

        return request;
    }

    async send(request: HttpRequest): Promise<HttpResponse> {
        this.requests.push(request);
        const answer = this.#answers.shift();

        if (answer === undefined) {
            throw new Error(`StubTransport: no answer queued for ${request.method} ${request.url}`);
        }

        if (answer instanceof Error) {
            throw answer;
        }

        return answer;
    }
}

/**
 * A JSON answer, as the API sends them.
 */
export function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): HttpResponse {
    return new HttpResponse(
        status,
        { 'Content-Type': 'application/json', ...headers },
        body === undefined ? '' : JSON.stringify(body),
    );
}

/**
 * A client whose requests get the given answers in turn.
 */
export function clientAnswering(...answers: StubAnswer[]): { client: SmsClient; transport: StubTransport } {
    const transport = new StubTransport(...answers);

    return { client: SmsClient.create('test-api-key', { transport }), transport };
}

/**
 * An HTTP client whose requests get the given answers in turn.
 */
export function httpClientAnswering(...answers: StubAnswer[]): { httpClient: HttpClient; transport: StubTransport } {
    const transport = new StubTransport(...answers);
    const httpClient = new HttpClient({ authProvider: { getToken: () => 'test-api-key' }, transport });

    return { httpClient, transport };
}

/**
 * The decoded JSON body of a request.
 */
export function requestBody(request: HttpRequest): unknown {
    return request.body === null ? null : JSON.parse(request.body);
}
