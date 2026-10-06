import { describe, expect, it } from 'vitest';
import { Message, ShortenedLink } from '../../../src/index.js';
import { MESSAGE_ID, messageData, PHONE, shortenedLinkData } from '../../support/fixtures.js';

describe('Message.fromObject()', () => {
    it('reads every field', () => {
        const message = Message.fromObject(
            messageData({
                sent_at: '2025-02-06T10:18:50.000000Z',
                delivered_at: '2025-02-06T10:18:53.000000Z',
                status: 'delivered',
                parts: 2,
            }),
        );

        expect(message).toBeInstanceOf(Message);
        expect(message).toEqual(
            new Message({
                id: MESSAGE_ID,
                recipient: PHONE,
                body: 'Hello from Calisero!',
                parts: 2,
                createdAt: '2025-02-06T10:18:43.000000Z',
                scheduledAt: '2025-02-06T10:18:43.000000Z',
                sentAt: '2025-02-06T10:18:50.000000Z',
                deliveredAt: '2025-02-06T10:18:53.000000Z',
                callbackUrl: 'https://yourapp.com/webhooks/calisero',
                status: 'delivered',
                sender: 'CALISERO',
                shortenedUrls: [],
            }),
        );
    });

    it('reads the optional fields as null when they are missing', () => {
        const message = Message.fromObject({
            id: MESSAGE_ID,
            recipient: PHONE,
            body: 'Hello',
            parts: 1,
            created_at: '2025-02-06T10:18:43.000000Z',
            status: 'scheduled',
        });

        expect(message.scheduledAt).toBeNull();
        expect(message.sentAt).toBeNull();
        expect(message.deliveredAt).toBeNull();
        expect(message.callbackUrl).toBeNull();
        expect(message.sender).toBeNull();
        expect(message.shortenedUrls).toEqual([]);
    });

    it('reads the shortened links', () => {
        const message = Message.fromObject(
            messageData({
                shortened_urls: [
                    shortenedLinkData(),
                    shortenedLinkData({
                        id: '019adfbb-40a4-70af-ba6c-55b7a07826e6',
                        original_link: 'https://yourstore.com/stop',
                        shortened_link: 'https://calisero.ro/s/qpmHfD',
                        click_count: 0,
                        last_click: null,
                    }),
                ],
            }),
        );

        expect(message.shortenedUrls).toHaveLength(2);
        expect(message.shortenedUrls[0]).toBeInstanceOf(ShortenedLink);
        expect(message.shortenedUrls.map((link) => link.shortenedLink)).toEqual([
            'https://calisero.ro/s/ghJKPV',
            'https://calisero.ro/s/qpmHfD',
        ]);
        expect(message.shortenedUrls[1]?.lastClick).toBeNull();
    });

    it('names a missing required field', () => {
        const { id: _, ...withoutId } = messageData();

        expect(() => Message.fromObject(withoutId)).toThrow(
            new TypeError('Invalid message: "id" must be a string, got nothing.'),
        );
    });

    it('refuses a number of parts that is not an integer', () => {
        expect(() => Message.fromObject(messageData({ parts: '1' }))).toThrow(
            'Invalid message: "parts" must be an integer, got a string.',
        );
        expect(() => Message.fromObject(messageData({ parts: 1.5 }))).toThrow('"parts" must be an integer');
    });

    it('names the shortened link at fault', () => {
        expect(() => Message.fromObject(messageData({ shortened_urls: [shortenedLinkData(), { id: 'x' }] }))).toThrow(
            'Invalid message.shortened_urls[1]: "original_link" must be a string, got nothing.',
        );
    });

    it('refuses what is not an object', () => {
        expect(() => Message.fromObject(null)).toThrow('Invalid message: expected an object, got null.');
        expect(() => Message.fromObject([])).toThrow('Invalid message: expected an object, got an array.');
        expect(() => Message.fromObject('message')).toThrow('Invalid message: expected an object, got a string.');
    });
});

describe('ShortenedLink.fromObject()', () => {
    it('reads a clicked link', () => {
        expect(ShortenedLink.fromObject(shortenedLinkData())).toEqual(
            new ShortenedLink({
                id: '019adfbb-40a1-71ee-bcb5-8d551b8cfdae',
                originalLink: 'https://yourstore.com/orders/12345/tracking',
                shortenedLink: 'https://calisero.ro/s/ghJKPV',
                clickCount: 3,
                lastClick: '2025-12-02T16:01:12.000000Z',
                createdAt: '2025-12-02T15:43:02.000000Z',
            }),
        );
    });

    it('reads a link never clicked', () => {
        const link = ShortenedLink.fromObject(shortenedLinkData({ click_count: undefined, last_click: null }));

        expect(link.clickCount).toBe(0);
        expect(link.lastClick).toBeNull();
    });
});
