/**
 * A decoded JSON object.
 */
export type JsonObject = Record<string, unknown>;

/**
 * Whether a decoded JSON value is an object: not null, not an array.
 *
 * @internal
 */
export function isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * What a value is, for error messages: `null`, `an array`, `a string`…
 *
 * @internal
 */
export function describeValue(value: unknown): string {
    if (value === null) {
        return 'null';
    }

    if (value === undefined) {
        return 'nothing';
    }

    if (Array.isArray(value)) {
        return 'an array';
    }

    const type = typeof value;

    return type === 'object' ? 'an object' : `a ${type}`;
}
