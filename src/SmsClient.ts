import { BearerTokenAuthProvider } from './auth/BearerTokenAuthProvider.js';
import type { AuthProvider } from './contracts/AuthProvider.js';
import type { Transport } from './contracts/Transport.js';
import { FetchTransport } from './http/FetchTransport.js';
import { HttpClient } from './http/HttpClient.js';
import type { AppInfo } from './http/userAgent.js';
import { AccountService } from './services/AccountService.js';
import { MessageService } from './services/MessageService.js';
import { OptOutService } from './services/OptOutService.js';
import { VerificationService } from './services/VerificationService.js';
import { VERSION } from './version.js';

export interface SmsClientOptions {
    /**
     * The API's base URL: `https://rest.calisero.ro/api/v1` by default.
     */
    readonly baseUrl?: string | undefined;

    /**
     * Milliseconds to wait for each answer: 30 000 by default. Ignored when a
     * `transport` is given.
     */
    readonly timeout?: number | undefined;

    /**
     * The fetch implementation, e.g. undici's with a proxy dispatcher: the global
     * fetch of Node.js by default. Ignored when a `transport` is given.
     */
    readonly fetch?: typeof globalThis.fetch | undefined;

    /**
     * Sends the requests instead of the default {@link FetchTransport}, e.g. a stub
     * in tests.
     */
    readonly transport?: Transport | undefined;

    /**
     * Your application, named in the User-Agent header after the library, e.g.
     * `{ name: 'MyShop', version: '2.1.0' }`.
     */
    readonly appInfo?: AppInfo | null | undefined;
}

/**
 * The Calisero SMS API client.
 *
 * ```ts
 * const client = SmsClient.create(process.env.CALISERO_API_KEY);
 * const { data: message } = await client.messages.create({ recipient: '+40742123456', body: 'Hello!' });
 * ```
 */
export class SmsClient {
    /**
     * The library's version, sent in the User-Agent header.
     */
    static readonly VERSION: string = VERSION;

    /**
     * The HTTP client the services share; its `lastResponse` is the raw answer to
     * the last request.
     */
    readonly httpClient: HttpClient;

    /**
     * Send and manage SMS messages.
     */
    readonly messages: MessageService;

    /**
     * Manage the phone numbers that opted out.
     */
    readonly optOuts: OptOutService;

    /**
     * Read the account: credit, status and daily sending limit.
     */
    readonly accounts: AccountService;

    /**
     * Verify phone numbers with one-time codes.
     */
    readonly verifications: VerificationService;

    /**
     * A client on an HTTP client you built yourself; {@link SmsClient.create} builds
     * one for you.
     */
    constructor(httpClient: HttpClient) {
        this.httpClient = httpClient;
        this.messages = new MessageService(httpClient);
        this.optOuts = new OptOutService(httpClient);
        this.accounts = new AccountService(httpClient);
        this.verifications = new VerificationService(httpClient);
    }

    /**
     * Create a client that authenticates with an API key, or with an
     * {@link AuthProvider} of your own.
     *
     * @throws {TypeError} when the API key is missing or empty, or `appInfo` has no usable name
     */
    static create(apiKey: string | AuthProvider | undefined, options: SmsClientOptions = {}): SmsClient {
        const authProvider = isAuthProvider(apiKey) ? apiKey : new BearerTokenAuthProvider(apiKey as string);
        const transport = options.transport ?? new FetchTransport({ timeout: options.timeout, fetch: options.fetch });

        return new SmsClient(
            new HttpClient({ authProvider, transport, baseUrl: options.baseUrl, appInfo: options.appInfo }),
        );
    }
}

function isAuthProvider(value: unknown): value is AuthProvider {
    return (
        typeof value === 'object' && value !== null && typeof (value as Partial<AuthProvider>).getToken === 'function'
    );
}
