import { describeValue, isJsonObject, type JsonObject } from './json.js';

/**
 * Builds the error thrown for a missing or malformed field.
 */
export type FieldErrorFactory = (message: string) => Error;

const typeError: FieldErrorFactory = (message) => new TypeError(message);

/**
 * Reads the fields of a decoded JSON object: a required field that is missing or
 * of the wrong type throws an error naming it, an optional one reads as null.
 *
 * @internal
 */
export class FieldReader {
    private constructor(
        private readonly data: JsonObject,
        private readonly context: string,
        private readonly error: FieldErrorFactory,
    ) {}

    /**
     * A reader of `data`, which must be an object; `context` names it in errors.
     */
    static of(data: unknown, context: string, error: FieldErrorFactory = typeError): FieldReader {
        if (!isJsonObject(data)) {
            throw error(`Invalid ${context}: expected an object, got ${describeValue(data)}.`);
        }

        return new FieldReader(data, context, error);
    }

    string(key: string): string {
        const value = this.data[key];

        if (typeof value !== 'string') {
            throw this.invalid(key, 'a string', value);
        }

        return value;
    }

    nonEmptyString(key: string): string {
        const value = this.data[key];

        if (typeof value !== 'string' || value === '') {
            throw this.invalid(key, 'a non-empty string', value);
        }

        return value;
    }

    optionalString(key: string): string | null {
        const value = this.data[key];

        return typeof value === 'string' ? value : null;
    }

    integer(key: string): number {
        const value = this.data[key];

        if (!Number.isSafeInteger(value)) {
            throw this.invalid(key, 'an integer', value);
        }

        return value as number;
    }

    optionalInteger(key: string): number | null {
        const value = this.data[key];

        return Number.isSafeInteger(value) ? (value as number) : null;
    }

    /**
     * A finite number, or a string holding one (amounts may come as strings).
     */
    number(key: string): number {
        const value = toNumber(this.data[key]);

        if (value === null) {
            throw this.invalid(key, 'a number', this.data[key]);
        }

        return value;
    }

    optionalNumber(key: string): number | null {
        return toNumber(this.data[key]);
    }

    boolean(key: string): boolean {
        const value = this.data[key];

        if (typeof value !== 'boolean') {
            throw this.invalid(key, 'a boolean', value);
        }

        return value;
    }

    object(key: string): JsonObject {
        const value = this.data[key];

        if (!isJsonObject(value)) {
            throw this.invalid(key, 'an object', value);
        }

        return value;
    }

    array(key: string): unknown[] {
        const value = this.data[key];

        if (!Array.isArray(value)) {
            throw this.invalid(key, 'an array', value);
        }

        return value;
    }

    /**
     * The array under `key`, or an empty array when it is absent or not one.
     */
    optionalArray(key: string): unknown[] {
        const value = this.data[key];

        return Array.isArray(value) ? value : [];
    }

    private invalid(key: string, expected: string, value: unknown): Error {
        return this.error(`Invalid ${this.context}: "${key}" must be ${expected}, got ${describeValue(value)}.`);
    }
}

function toNumber(value: unknown): number | null {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string' && value.trim() !== '') {
        const number = Number(value);

        return Number.isFinite(number) ? number : null;
    }

    return null;
}
