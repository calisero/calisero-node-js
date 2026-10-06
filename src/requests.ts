import type { JsonObject } from './internal/json.js';
import { formatScheduleAt } from './internal/scheduleAt.js';

/**
 * A message to send. Optional fields left out (or null) are not sent.
 */
export interface CreateMessageRequest {
    /**
     * The recipient's mobile number in international E.164 format, e.g. `+40742123456`.
     */
    readonly recipient: string;

    /**
     * The text sent, at most 1600 characters.
     */
    readonly body: string;

    /**
     * What the API shows instead of `body` in its answers, its lists and the
     * dashboard, e.g. the text with a code masked: `Your code is ******`.
     */
    readonly visibleBody?: string | null | undefined;

    /**
     * The message's validity period, in hours.
     */
    readonly validity?: number | null | undefined;

    /**
     * When to send the message: a `Date`, converted to Romania time, or a
     * `YYYY-MM-DD HH:MM:SS` string in Romania time. Sent at once when omitted or
     * already past today; from today to 5 years ahead.
     */
    readonly scheduleAt?: Date | string | null | undefined;

    /**
     * The URL Calisero posts the message's delivery status updates to.
     */
    readonly callbackUrl?: string | null | undefined;

    /**
     * One of the account's approved sender IDs, exactly as approved; the default
     * sender when omitted.
     */
    readonly sender?: string | null | undefined;

    /**
     * Replace the `http://` and `https://` links of the body with short ones, whose
     * clicks are counted. The body is sent as written when omitted.
     */
    readonly shortenUrls?: boolean | null | undefined;
}

/**
 * A phone number to opt out of receiving messages.
 */
export interface CreateOptOutRequest {
    /**
     * The phone number in international E.164 format.
     */
    readonly phone: string;

    /**
     * Why the number opted out, at most 600 characters.
     */
    readonly reason?: string | null | undefined;
}

/**
 * The new data of an opt-out.
 */
export interface UpdateOptOutRequest {
    /**
     * The phone number in international E.164 format.
     */
    readonly phone: string;

    /**
     * Why the number opted out, at most 600 characters.
     */
    readonly reason?: string | null | undefined;
}

/**
 * A verification to start: Calisero generates a code and sends it by SMS.
 */
export interface CreateVerificationRequest {
    /**
     * The phone number to verify, in international E.164 format.
     */
    readonly phone: string;

    /**
     * The brand named in the default message, at most 120 characters: required
     * unless a `template` is given.
     */
    readonly brand?: string | null | undefined;

    /**
     * A custom message, at most 600 characters, that must hold `{code}`.
     */
    readonly template?: string | null | undefined;

    /**
     * How many minutes the code stays valid, 1 to 10: 5 when omitted.
     */
    readonly expiresIn?: number | null | undefined;
}

/**
 * A code to check against the latest verification of a phone number.
 */
export interface VerificationCheckRequest {
    /**
     * The phone number the code was sent to, in international E.164 format.
     */
    readonly phone: string;

    /**
     * The 6-character code received, in any case.
     */
    readonly code: string;
}

/**
 * The body of `POST /messages`.
 *
 * @internal
 */
export function createMessagePayload(request: CreateMessageRequest): JsonObject {
    return withoutNulls({
        recipient: request.recipient,
        body: request.body,
        visible_body: request.visibleBody,
        validity: request.validity,
        schedule_at:
            request.scheduleAt === null || request.scheduleAt === undefined
                ? null
                : formatScheduleAt(request.scheduleAt),
        callback_url: request.callbackUrl,
        sender: request.sender,
        shorten_urls: request.shortenUrls,
    });
}

/**
 * The body of `POST /opt-outs` and `PUT /opt-outs/{id}`.
 *
 * @internal
 */
export function optOutPayload(request: CreateOptOutRequest | UpdateOptOutRequest): JsonObject {
    return withoutNulls({ phone: request.phone, reason: request.reason });
}

/**
 * The body of `POST /verifications`.
 *
 * @internal
 */
export function createVerificationPayload(request: CreateVerificationRequest): JsonObject {
    return withoutNulls({
        phone: request.phone,
        brand: request.brand,
        template: request.template,
        expires_in: request.expiresIn,
    });
}

/**
 * The body of `PUT /verifications/validate`.
 *
 * @internal
 */
export function verificationCheckPayload(request: VerificationCheckRequest): JsonObject {
    return { phone: request.phone, code: request.code };
}

function withoutNulls(data: Record<string, unknown>): JsonObject {
    return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== null && value !== undefined));
}
