import { InvalidWebhookPayloadError } from '../errors.js';
import { FieldReader } from '../internal/FieldReader.js';

/**
 * The statuses a delivery status callback reports; other values may come with
 * future API versions.
 */
export type DeliveryStatus = 'sent' | 'delivered' | 'undelivered' | (string & {});

export interface DeliveryWebhookMessageProps {
    readonly messageId: string;
    readonly sender: string | null;
    readonly recipient: string;
    readonly status: DeliveryStatus;
    readonly scheduleAt: string | null;
    readonly sentAt: string | null;
    readonly deliveredAt: string | null;
    readonly price: number;
    readonly remainingBalance: number | null;
    readonly dailyLimit: number | null;
    readonly dailyRemaining: number | null;
    readonly sentToday: number | null;
}

const payloadError = (message: string): Error => new InvalidWebhookPayloadError(message);

/**
 * The payload Calisero posts to a message's callback URL when its status changes:
 * sent, delivered or undelivered.
 *
 * It reaches your endpoint from outside your application, so it is validated: a
 * malformed payload throws an {@link InvalidWebhookPayloadError}.
 */
export class DeliveryWebhookMessage implements DeliveryWebhookMessageProps {
    readonly messageId: string;

    /**
     * The sender ID the message went out under; null for the default sender.
     */
    readonly sender: string | null;

    /**
     * The recipient in E.164 format.
     */
    readonly recipient: string;

    /**
     * The delivery status: sent, delivered or undelivered.
     */
    readonly status: DeliveryStatus;

    /**
     * When the message was scheduled to go out, if it was scheduled.
     */
    readonly scheduleAt: string | null;

    /**
     * When the message was handed to the network (statuses sent and delivered).
     */
    readonly sentAt: string | null;

    /**
     * When the handset confirmed delivery (status delivered only).
     */
    readonly deliveredAt: string | null;

    /**
     * The price charged for the message's parts.
     */
    readonly price: number;

    /**
     * The account's balance after billing, if available.
     */
    readonly remainingBalance: number | null;

    /**
     * The account's daily sending limit when the callback was sent; null when no
     * daily limit applies.
     */
    readonly dailyLimit: number | null;

    /**
     * How many messages the account could still send today when the callback was
     * sent; null when no daily limit applies.
     */
    readonly dailyRemaining: number | null;

    /**
     * The real messages the account created today, Romania time, when the callback
     * was sent: OTP codes included, test messages left out, one per message
     * whatever its parts. Null in payloads that predate the daily limit.
     */
    readonly sentToday: number | null;

    constructor(props: DeliveryWebhookMessageProps) {
        this.messageId = props.messageId;
        this.sender = props.sender;
        this.recipient = props.recipient;
        this.status = props.status;
        this.scheduleAt = props.scheduleAt;
        this.sentAt = props.sentAt;
        this.deliveredAt = props.deliveredAt;
        this.price = props.price;
        this.remainingBalance = props.remainingBalance;
        this.dailyLimit = props.dailyLimit;
        this.dailyRemaining = props.dailyRemaining;
        this.sentToday = props.sentToday;
    }

    /**
     * Read the raw body of a callback request: a string, or a Buffer (e.g. from
     * `express.raw()`).
     *
     * @throws {InvalidWebhookPayloadError} when the body is not a JSON object or a
     *                                      required field is missing or malformed
     */
    static fromJson(json: string | Uint8Array): DeliveryWebhookMessage {
        const text = typeof json === 'string' ? json : new TextDecoder().decode(json);
        let data: unknown;

        try {
            data = JSON.parse(text);
        } catch (error) {
            throw new InvalidWebhookPayloadError(`Invalid delivery webhook payload: ${(error as Error).message}`, {
                cause: error,
            });
        }

        return DeliveryWebhookMessage.fromObject(data);
    }

    /**
     * Read the decoded body of a callback request (e.g. `req.body` after
     * `express.json()`).
     *
     * @throws {InvalidWebhookPayloadError} when it is not an object or a required
     *                                      field is missing or malformed
     */
    static fromObject(data: unknown): DeliveryWebhookMessage {
        const read = FieldReader.of(data, 'delivery webhook payload', payloadError);

        return new DeliveryWebhookMessage({
            messageId: read.nonEmptyString('messageId'),
            sender: read.optionalString('sender'),
            recipient: read.nonEmptyString('recipient'),
            status: read.nonEmptyString('status'),
            scheduleAt: read.optionalString('scheduleAt'),
            sentAt: read.optionalString('sentAt'),
            deliveredAt: read.optionalString('deliveredAt'),
            price: read.number('price'),
            remainingBalance: read.optionalNumber('remainingBalance'),
            dailyLimit: read.optionalInteger('dailyLimit'),
            dailyRemaining: read.optionalInteger('dailyRemaining'),
            sentToday: read.optionalInteger('sentToday'),
        });
    }
}
