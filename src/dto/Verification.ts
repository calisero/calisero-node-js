import { FieldReader } from '../internal/FieldReader.js';

/**
 * The statuses of a verification; other values may come with future API versions.
 */
export type VerificationStatus = 'unverified' | 'verified' | (string & {});

export interface VerificationProps {
    readonly id: string;
    readonly phone: string;
    readonly brand: string | null;
    readonly status: VerificationStatus;
    readonly template: string | null;
    readonly createdAt: string;
    readonly expiresAt: string;
    readonly verifiedAt: string | null;
    readonly attempts: number;
    readonly expired: boolean;
}

/**
 * A phone verification: a one-time code sent by SMS, to be validated.
 */
export class Verification implements VerificationProps {
    readonly id: string;
    readonly phone: string;

    /**
     * The brand named in the default message; null when a template was used.
     */
    readonly brand: string | null;

    readonly status: VerificationStatus;

    /**
     * The custom message template, holding `{code}`; null for the default message.
     */
    readonly template: string | null;

    readonly createdAt: string;
    readonly expiresAt: string;
    readonly verifiedAt: string | null;

    /**
     * How many times a code was checked against this verification.
     */
    readonly attempts: number;

    readonly expired: boolean;

    constructor(props: VerificationProps) {
        this.id = props.id;
        this.phone = props.phone;
        this.brand = props.brand;
        this.status = props.status;
        this.template = props.template;
        this.createdAt = props.createdAt;
        this.expiresAt = props.expiresAt;
        this.verifiedAt = props.verifiedAt;
        this.attempts = props.attempts;
        this.expired = props.expired;
    }

    /**
     * Read a verification as the API sends it.
     *
     * @throws {TypeError} when a required field is missing or malformed
     */
    static fromObject(data: unknown, context = 'verification'): Verification {
        const read = FieldReader.of(data, context);

        return new Verification({
            id: read.string('id'),
            phone: read.string('phone'),
            brand: read.optionalString('brand'),
            status: read.string('status'),
            template: read.optionalString('template'),
            createdAt: read.string('created_at'),
            expiresAt: read.string('expires_at'),
            verifiedAt: read.optionalString('verified_at'),
            attempts: read.integer('attempts'),
            expired: read.boolean('expired'),
        });
    }
}
