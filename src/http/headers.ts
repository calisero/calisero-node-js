import type { HttpResponse } from './HttpResponse.js';

/**
 * The header's first value, trimmed; null when the header is absent or empty.
 *
 * @internal
 */
export function readHeaderString(response: HttpResponse, name: string): string | null {
    const value = response.getHeader(name)[0]?.trim() ?? '';

    return value !== '' ? value : null;
}

/**
 * The header's value as a non-negative integer; null when it is absent or not one.
 *
 * @internal
 */
export function readHeaderInt(response: HttpResponse, name: string): number | null {
    const value = readHeaderString(response, name);

    if (value === null || !/^\d+$/.test(value)) {
        return null;
    }

    const number = Number(value);

    return Number.isSafeInteger(number) ? number : null;
}
