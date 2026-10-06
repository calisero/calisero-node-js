import { FieldReader } from '../internal/FieldReader.js';

export interface OptOutProps {
    readonly id: string;
    readonly phone: string;
    readonly reason: string | null;
    readonly createdAt: string;
    readonly updatedAt: string;
}

/**
 * A phone number that opted out of receiving messages.
 */
export class OptOut implements OptOutProps {
    readonly id: string;
    readonly phone: string;
    readonly reason: string | null;
    readonly createdAt: string;
    readonly updatedAt: string;

    constructor(props: OptOutProps) {
        this.id = props.id;
        this.phone = props.phone;
        this.reason = props.reason;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
    }

    /**
     * Read an opt-out as the API sends it.
     *
     * @throws {TypeError} when a required field is missing or malformed
     */
    static fromObject(data: unknown, context = 'opt-out'): OptOut {
        const read = FieldReader.of(data, context);

        return new OptOut({
            id: read.string('id'),
            phone: read.string('phone'),
            reason: read.optionalString('reason'),
            createdAt: read.string('created_at'),
            updatedAt: read.string('updated_at'),
        });
    }
}
