/**
 * The headers an {@link HttpResponse} is built from: a fetch `Headers`, any
 * iterable of name/value pairs, or a plain object whose values are strings or
 * arrays of strings.
 */
export type ResponseHeadersInit =
    | Iterable<readonly [string, string]>
    | Readonly<Record<string, string | readonly string[] | undefined>>;

/**
 * The raw answer of the API: status, headers and body.
 */
export class HttpResponse {
    /**
     * The HTTP status code.
     */
    readonly status: number;

    /**
     * The body as received; empty when there was none.
     */
    readonly body: string;

    readonly #headers = new Map<string, string[]>();

    constructor(status: number, headers: ResponseHeadersInit = {}, body = '') {
        this.status = status;
        this.body = body;

        const entries: Iterable<readonly [string, string | readonly string[] | undefined]> = isIterable(headers)
            ? headers
            : Object.entries(headers);

        for (const [name, value] of entries) {
            if (value === undefined) {
                continue;
            }

            const key = name.toLowerCase();
            const values = this.#headers.get(key) ?? [];
            values.push(...(typeof value === 'string' ? [value] : value));
            this.#headers.set(key, values);
        }
    }

    /**
     * All headers, their names in lowercase.
     */
    get headers(): Record<string, string[]> {
        return Object.fromEntries([...this.#headers].map(([name, values]) => [name, [...values]]));
    }

    /**
     * The values of a header, its name matched case-insensitively, as HTTP defines
     * them; empty when the answer did not carry it.
     */
    getHeader(name: string): string[] {
        return [...(this.#headers.get(name.toLowerCase()) ?? [])];
    }

    /**
     * The values of a header joined with a comma; empty when the answer did not carry it.
     */
    getHeaderLine(name: string): string {
        return this.getHeader(name).join(', ');
    }

    hasHeader(name: string): boolean {
        return this.#headers.has(name.toLowerCase());
    }
}

function isIterable(value: ResponseHeadersInit): value is Iterable<readonly [string, string]> {
    return typeof (value as Partial<Iterable<unknown>>)[Symbol.iterator] === 'function';
}
