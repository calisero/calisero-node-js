import { FieldReader } from '../internal/FieldReader.js';

/**
 * The statuses of an account; other values may come with future API versions.
 */
export type AccountStatus = 'active' | 'pending' | 'disabled' | (string & {});

export interface AccountProps {
    readonly id: string;
    readonly code: string;
    readonly name: string;
    readonly description: string | null;
    readonly fiscalCode: string | null;
    readonly registryNumber: string | null;
    readonly iban: string | null;
    readonly city: string | null;
    readonly state: string | null;
    readonly country: string | null;
    readonly address: string | null;
    readonly postalCode: number | null;
    readonly email: string | null;
    readonly phone: string | null;
    readonly contactPerson: string | null;
    readonly credit: number;
    readonly status: AccountStatus;
    readonly sandbox: boolean;
    readonly dailyLimit: number | null;
    readonly dailyRemaining: number | null;
    readonly sentToday: number;
    readonly createdAt: string;
}

/**
 * A Calisero account.
 */
export class Account implements AccountProps {
    readonly id: string;
    readonly code: string;
    readonly name: string;
    readonly description: string | null;
    readonly fiscalCode: string | null;
    readonly registryNumber: string | null;
    readonly iban: string | null;
    readonly city: string | null;
    readonly state: string | null;
    readonly country: string | null;
    readonly address: string | null;
    readonly postalCode: number | null;
    readonly email: string | null;
    readonly phone: string | null;
    readonly contactPerson: string | null;

    /**
     * The account's credit balance.
     */
    readonly credit: number;

    readonly status: AccountStatus;

    /**
     * Whether this is a sandbox account: its messages are test messages, marked
     * delivered at once, never sent to a phone nor billed.
     */
    readonly sandbox: boolean;

    /**
     * How many messages the account can send in a day, midnight to midnight,
     * Romania time; null when no daily limit applies.
     */
    readonly dailyLimit: number | null;

    /**
     * How many messages the account can still send today; null when no daily
     * limit applies.
     */
    readonly dailyRemaining: number | null;

    /**
     * The real messages the account created today, Romania time: OTP codes
     * included, test messages left out, one per message whatever its parts.
     */
    readonly sentToday: number;

    readonly createdAt: string;

    constructor(props: AccountProps) {
        this.id = props.id;
        this.code = props.code;
        this.name = props.name;
        this.description = props.description;
        this.fiscalCode = props.fiscalCode;
        this.registryNumber = props.registryNumber;
        this.iban = props.iban;
        this.city = props.city;
        this.state = props.state;
        this.country = props.country;
        this.address = props.address;
        this.postalCode = props.postalCode;
        this.email = props.email;
        this.phone = props.phone;
        this.contactPerson = props.contactPerson;
        this.credit = props.credit;
        this.status = props.status;
        this.sandbox = props.sandbox;
        this.dailyLimit = props.dailyLimit;
        this.dailyRemaining = props.dailyRemaining;
        this.sentToday = props.sentToday;
        this.createdAt = props.createdAt;
    }

    /**
     * Read an account as the API sends it.
     *
     * @throws {TypeError} when a required field is missing or malformed
     */
    static fromObject(data: unknown, context = 'account'): Account {
        const read = FieldReader.of(data, context);

        return new Account({
            id: read.string('id'),
            code: read.string('code'),
            name: read.string('name'),
            description: read.optionalString('description'),
            fiscalCode: read.optionalString('fiscal_code'),
            registryNumber: read.optionalString('registry_number'),
            iban: read.optionalString('iban'),
            city: read.optionalString('city'),
            state: read.optionalString('state'),
            country: read.optionalString('country'),
            address: read.optionalString('address'),
            postalCode: read.optionalInteger('postal_code'),
            email: read.optionalString('email'),
            phone: read.optionalString('phone'),
            contactPerson: read.optionalString('contact_person'),
            credit: read.number('credit'),
            status: read.string('status'),
            sandbox: read.boolean('sandbox'),
            dailyLimit: read.optionalInteger('daily_limit'),
            dailyRemaining: read.optionalInteger('daily_remaining'),
            sentToday: read.optionalInteger('sent_today') ?? 0,
            createdAt: read.string('created_at'),
        });
    }
}
