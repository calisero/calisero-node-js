/**
 * Provides the bearer token the API authenticates requests with: the API key.
 *
 * `getToken()` is called for every request and may be asynchronous, e.g. to read
 * the key from a secret manager.
 */
export interface AuthProvider {
    getToken(): string | Promise<string>;
}
