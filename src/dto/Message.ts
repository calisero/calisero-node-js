import { FieldReader } from '../internal/FieldReader.js';
import { ShortenedLink } from './ShortenedLink.js';

/**
 * The statuses of a message; other values may come with future API versions.
 */
export type MessageStatus =
    | 'scheduled'
    | 'pending'
    | 'queued'
    | 'sent'
    | 'delivered'
    | 'undelivered'
    | 'failed'
    | 'canceled'
    | (string & {});

export interface MessageProps {
    readonly id: string;
    readonly recipient: string;
    readonly body: string;
    readonly parts: number;
    readonly createdAt: string;
    readonly scheduledAt: string | null;
    readonly sentAt: string | null;
    readonly deliveredAt: string | null;
    readonly callbackUrl: string | null;
    readonly status: MessageStatus;
    readonly sender: string | null;
    readonly shortenedUrls: readonly ShortenedLink[];
}

/**
 * An SMS message.
 */
export class Message implements MessageProps {
    readonly id: string;

    /**
     * The recipient's phone number.
     */
    readonly recipient: string;

    readonly body: string;

    /**
     * How many SMS parts the body takes.
     */
    readonly parts: number;

    readonly createdAt: string;
    readonly scheduledAt: string | null;
    readonly sentAt: string | null;
    readonly deliveredAt: string | null;
    readonly callbackUrl: string | null;
    readonly status: MessageStatus;

    /**
     * The sender ID; null for the default sender.
     */
    readonly sender: string | null;

    /**
     * The links of the body Calisero shortened (requested with `shortenUrls`),
     * with their click statistics; empty when none were.
     */
    readonly shortenedUrls: readonly ShortenedLink[];

    constructor(props: MessageProps) {
        this.id = props.id;
        this.recipient = props.recipient;
        this.body = props.body;
        this.parts = props.parts;
        this.createdAt = props.createdAt;
        this.scheduledAt = props.scheduledAt;
        this.sentAt = props.sentAt;
        this.deliveredAt = props.deliveredAt;
        this.callbackUrl = props.callbackUrl;
        this.status = props.status;
        this.sender = props.sender;
        this.shortenedUrls = props.shortenedUrls;
    }

    /**
     * Read a message as the API sends it.
     *
     * @throws {TypeError} when a required field is missing or malformed
     */
    static fromObject(data: unknown, context = 'message'): Message {
        const read = FieldReader.of(data, context);

        return new Message({
            id: read.string('id'),
            recipient: read.string('recipient'),
            body: read.string('body'),
            parts: read.integer('parts'),
            createdAt: read.string('created_at'),
            scheduledAt: read.optionalString('scheduled_at'),
            sentAt: read.optionalString('sent_at'),
            deliveredAt: read.optionalString('delivered_at'),
            callbackUrl: read.optionalString('callback_url'),
            status: read.string('status'),
            sender: read.optionalString('sender'),
            shortenedUrls: read
                .optionalArray('shortened_urls')
                .map((link, index) => ShortenedLink.fromObject(link, `${context}.shortened_urls[${index}]`)),
        });
    }
}
