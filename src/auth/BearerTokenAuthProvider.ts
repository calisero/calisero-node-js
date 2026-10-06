import type { AuthProvider } from '../contracts/AuthProvider.js';

/**
 * Authenticates with a fixed API key.
 */
export class BearerTokenAuthProvider implements AuthProvider {
    readonly #token: string;

    constructor(token: string) {
        if (typeof token !== 'string' || token.trim() === '') {
            throw new TypeError('The API key must be a non-empty string.');
        }

        this.#token = token;
    }

    getToken(): string {
        return this.#token;
    }
}
