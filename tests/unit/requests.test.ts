import { describe, expect, it } from 'vitest';
import { formatScheduleAt } from '../../src/internal/scheduleAt.js';
import {
    createMessagePayload,
    createVerificationPayload,
    optOutPayload,
    verificationCheckPayload,
} from '../../src/requests.js';
import { PHONE } from '../support/fixtures.js';

describe('createMessagePayload()', () => {
    it('sends the recipient and the body of a minimal request', () => {
        expect(createMessagePayload({ recipient: PHONE, body: 'Hello!' })).toEqual({
            recipient: PHONE,
            body: 'Hello!',
        });
    });

    it('sends every option under its API name', () => {
        expect(
            createMessagePayload({
                recipient: PHONE,
                body: 'Your code is 123456',
                visibleBody: 'Your code is ******',
                validity: 24,
                scheduleAt: '2026-12-25 10:00:00',
                callbackUrl: 'https://yourapp.com/webhooks/calisero',
                sender: 'Calisero',
                shortenUrls: true,
            }),
        ).toEqual({
            recipient: PHONE,
            body: 'Your code is 123456',
            visible_body: 'Your code is ******',
            validity: 24,
            schedule_at: '2026-12-25 10:00:00',
            callback_url: 'https://yourapp.com/webhooks/calisero',
            sender: 'Calisero',
            shorten_urls: true,
        });
    });

    it('leaves out the options that are null or undefined', () => {
        expect(
            createMessagePayload({
                recipient: PHONE,
                body: 'Hello!',
                visibleBody: null,
                validity: undefined,
                scheduleAt: null,
                callbackUrl: undefined,
                sender: null,
                shortenUrls: undefined,
            }),
        ).toEqual({ recipient: PHONE, body: 'Hello!' });
    });

    it('keeps the options that are set to false or 0', () => {
        expect(createMessagePayload({ recipient: PHONE, body: 'Hello!', shortenUrls: false, validity: 0 })).toEqual({
            recipient: PHONE,
            body: 'Hello!',
            validity: 0,
            shorten_urls: false,
        });
    });

    it('sends a Date to schedule at in Romania time', () => {
        const payload = createMessagePayload({
            recipient: PHONE,
            body: 'Hello!',
            scheduleAt: new Date('2026-07-15T09:30:00Z'),
        });

        expect(payload.schedule_at).toBe('2026-07-15 12:30:00');
    });

    it('keeps the required fields required', () => {
        // Type checks only: tsc fails the build if these compile
        const typeChecks = (): void => {
            // @ts-expect-error the body is required
            createMessagePayload({ recipient: PHONE });
            // @ts-expect-error the recipient is required
            createMessagePayload({ body: 'Hello!' });
            // @ts-expect-error scheduleAt takes a Date or a string
            createMessagePayload({ recipient: PHONE, body: 'Hello!', scheduleAt: 1_790_000_000 });
        };

        expect(typeChecks).toBeTypeOf('function');
    });
});

describe('formatScheduleAt()', () => {
    it('converts a date in summer time (UTC+3)', () => {
        expect(formatScheduleAt(new Date('2026-07-15T09:30:00Z'))).toBe('2026-07-15 12:30:00');
    });

    it('converts a date in winter time (UTC+2)', () => {
        expect(formatScheduleAt(new Date('2026-01-15T09:30:05Z'))).toBe('2026-01-15 11:30:05');
    });

    it('writes midnight as 00, on the next day in Romania', () => {
        expect(formatScheduleAt(new Date('2026-03-01T22:00:00Z'))).toBe('2026-03-02 00:00:00');
    });

    it('follows the switch to summer time', () => {
        // On 2026-03-29 the clocks go from 03:00 to 04:00 in Romania
        expect(formatScheduleAt(new Date('2026-03-29T00:59:59Z'))).toBe('2026-03-29 02:59:59');
        expect(formatScheduleAt(new Date('2026-03-29T01:00:00Z'))).toBe('2026-03-29 04:00:00');
    });

    it('passes a string as is', () => {
        expect(formatScheduleAt('2026-12-25 10:00:00')).toBe('2026-12-25 10:00:00');
    });

    it('refuses an invalid date', () => {
        expect(() => formatScheduleAt(new Date('not a date'))).toThrow(RangeError);
        expect(() => formatScheduleAt(42 as unknown as Date)).toThrow(RangeError);
    });
});

describe('optOutPayload()', () => {
    it('sends the phone and the reason', () => {
        expect(optOutPayload({ phone: PHONE, reason: 'Asked to stop' })).toEqual({
            phone: PHONE,
            reason: 'Asked to stop',
        });
    });

    it('leaves out a missing reason', () => {
        expect(optOutPayload({ phone: PHONE })).toEqual({ phone: PHONE });
        expect(optOutPayload({ phone: PHONE, reason: null })).toEqual({ phone: PHONE });
    });
});

describe('createVerificationPayload()', () => {
    it('sends the phone and the brand', () => {
        expect(createVerificationPayload({ phone: PHONE, brand: 'Calisero' })).toEqual({
            phone: PHONE,
            brand: 'Calisero',
        });
    });

    it('sends a template and the expiry under their API names', () => {
        expect(
            createVerificationPayload({ phone: PHONE, template: 'Your code: {code}', expiresIn: 10, brand: null }),
        ).toEqual({ phone: PHONE, template: 'Your code: {code}', expires_in: 10 });
    });
});

describe('verificationCheckPayload()', () => {
    it('sends the phone and the code', () => {
        expect(verificationCheckPayload({ phone: PHONE, code: 'ABC123' })).toEqual({ phone: PHONE, code: 'ABC123' });
    });
});
