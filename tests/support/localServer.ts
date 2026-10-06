import { createServer, type IncomingMessage, type RequestListener, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface ReceivedRequest {
    readonly method: string;
    readonly url: string;
    readonly headers: IncomingMessage['headers'];
    readonly body: string;
}

export interface LocalServer {
    /**
     * The server's base URL, e.g. http://127.0.0.1:53412
     */
    readonly url: string;

    /**
     * The requests received, in order, with their bodies.
     */
    readonly received: ReceivedRequest[];

    close(): Promise<void>;
}

/**
 * An HTTP server on a free local port: the tests talk to it over real sockets,
 * never to the network.
 */
export async function startServer(
    handle: (request: IncomingMessage, response: ServerResponse, body: string) => void | Promise<void>,
): Promise<LocalServer> {
    const received: ReceivedRequest[] = [];

    const listener: RequestListener = (request, response) => {
        const chunks: Buffer[] = [];

        request.on('data', (chunk: Buffer) => chunks.push(chunk));
        request.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8');
            received.push({ method: request.method ?? '', url: request.url ?? '', headers: request.headers, body });

            void Promise.resolve(handle(request, response, body)).catch((error: unknown) => {
                response.writeHead(599).end(String(error));
            });
        });
    };

    return listen(createServer(listener), received);
}

/**
 * A server running the given request listener as is, e.g. a webhook handler.
 */
export async function startRawServer(listener: RequestListener): Promise<LocalServer> {
    return listen(createServer(listener), []);
}

async function listen(server: ReturnType<typeof createServer>, received: ReceivedRequest[]): Promise<LocalServer> {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;

    return {
        url: `http://127.0.0.1:${port}`,
        received,
        close: () =>
            new Promise<void>((resolve, reject) => {
                server.closeAllConnections();
                server.close((error) => (error ? reject(error) : resolve()));
            }),
    };
}

/**
 * Answer with a JSON body.
 */
export function sendJson(
    response: ServerResponse,
    status: number,
    body: unknown,
    headers: Record<string, string> = {},
): void {
    response.writeHead(status, { 'Content-Type': 'application/json', ...headers });
    response.end(body === undefined ? '' : JSON.stringify(body));
}
