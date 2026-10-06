import { describe, expect, it } from 'vitest';
import { DeliveryWebhookMessage, InvalidWebhookPayloadError } from '../../../src/index.js';
import { PHONE, webhookPayload } from '../../support/fixtures.js';

describe('DeliveryWebhookMessage.fromJson()', () => {
    it('reads a full payload', () => {
        const message = DeliveryWebhookMessage.fromJson(JSON.stringify(webhookPayload()));

        expect(message).toEqual(
            new DeliveryWebhookMessage({
                messageId: '019961db-14a7-7348-963f-5a7a789a969f',
                sender: 'CALISERO',
                recipient: PHONE,
                status: 'delivered',
                scheduleAt: '2025-09-19T12:02:51.000000Z',
                sentAt: '2025-09-19T12:01:15.000000Z',
                deliveredAt: '2025-09-19T12:02:53.000000Z',
                price: 0.0378,
                remainingBalance: 999.392,
                dailyLimit: 1000,
                dailyRemaining: 588,
                sentToday: 412,
            }),
        );
    });

    it('reads a raw body given as a Buffer or a Uint8Array', () => {
        const json = JSON.stringify(webhookPayload({ recipient: '+40742***351' }));

        expect(DeliveryWebhookMessage.fromJson(Buffer.from(json)).recipient).toBe('+40742***351');
        expect(DeliveryWebhookMessage.fromJson(new TextEncoder().encode(json)).recipient).toBe('+40742***351');
    });

    it('refuses a body that is not JSON', () => {
        let error: unknown;

        try {
            DeliveryWebhookMessage.fromJson('{not json');
        } catch (caught) {
            error = caught;
        }

        expect(error).toBeInstanceOf(InvalidWebhookPayloadError);
        expect((error as Error).message).toMatch(/^Invalid delivery webhook payload: /);
        expect((error as Error).cause).toBeInstanceOf(SyntaxError);
    });

    it('refuses JSON that is not an object, like the [] sent for a cancelled message', () => {
        expect(() => DeliveryWebhookMessage.fromJson('[]')).toThrow(
            new InvalidWebhookPayloadError('Invalid delivery webhook payload: expected an object, got an array.'),
        );
        expect(() => DeliveryWebhookMessage.fromJson('null')).toThrow(InvalidWebhookPayloadError);
    });
});

describe('DeliveryWebhookMessage.fromObject()', () => {
    it('reads a minimal payload', () => {
        const message = DeliveryWebhookMessage.fromObject({
            messageId: '019961db-14a7-7348-963f-5a7a789a969f',
            recipient: PHONE,
            status: 'sent',
            price: 0.0378,
        });

        expect(message).toMatchObject({
            sender: null,
            scheduleAt: null,
            sentAt: null,
            deliveredAt: null,
            remainingBalance: null,
            dailyLimit: null,
            dailyRemaining: null,
            sentToday: null,
        });
    });

    it('reads a payload of a message sent with the default sender', () => {
        expect(DeliveryWebhookMessage.fromObject(webhookPayload({ sender: null })).sender).toBeNull();
    });

    it('reads a payload that predates the daily limit', () => {
        const message = DeliveryWebhookMessage.fromObject(
            webhookPayload({ dailyLimit: undefined, dailyRemaining: undefined, sentToday: undefined }),
        );

        expect([message.dailyLimit, message.dailyRemaining, message.sentToday]).toEqual([null, null, null]);
    });

    it('reads an account without a daily limit', () => {
        const message = DeliveryWebhookMessage.fromObject(webhookPayload({ dailyLimit: null, dailyRemaining: null }));

        expect(message.dailyLimit).toBeNull();
        expect(message.sentToday).toBe(412);
    });

    it('reads amounts sent as strings', () => {
        const message = DeliveryWebhookMessage.fromObject(
            webhookPayload({ price: '0.0378', remainingBalance: '12.5' }),
        );

        expect(message.price).toBe(0.0378);
        expect(message.remainingBalance).toBe(12.5);
    });

    it.each([
        ['messageId', { messageId: undefined }, '"messageId" must be a non-empty string, got nothing'],
        ['messageId', { messageId: '' }, '"messageId" must be a non-empty string, got a string'],
        ['recipient', { recipient: 42 }, '"recipient" must be a non-empty string, got a number'],
        ['status', { status: null }, '"status" must be a non-empty string, got null'],
        ['price', { price: undefined }, '"price" must be a number, got nothing'],
        ['price', { price: 'free' }, '"price" must be a number, got a string'],
    ])('refuses a payload with a malformed %s', (_, overrides, message) => {
        expect(() => DeliveryWebhookMessage.fromObject(webhookPayload(overrides))).toThrow(
            new InvalidWebhookPayloadError(`Invalid delivery webhook payload: ${message}.`),
        );
    });

    it('ignores daily counts that are not integers', () => {
        const message = DeliveryWebhookMessage.fromObject(webhookPayload({ dailyLimit: 10.5, sentToday: '3' }));

        expect(message.dailyLimit).toBeNull();
        expect(message.sentToday).toBeNull();
    });
});
