import { describe, expect, it } from 'vitest';
import { HttpResponse, Message, Paginated, PaginationLinks, PaginationMeta, ResponseMeta } from '../../../src/index.js';
import { messageData, pageOf, TRACE_ID } from '../../support/fixtures.js';

describe('Paginated.fromObject()', () => {
    it('reads the items, the links and the meta of a page', () => {
        const page = Paginated.fromObject(
            pageOf([messageData(), messageData({ id: 'second' })], 'messages', 2, true),
            Message.fromObject,
        );

        expect(page.data).toHaveLength(2);
        expect(page.data[1]).toBeInstanceOf(Message);
        expect(page.data[1]?.id).toBe('second');
        expect(page.links).toEqual(
            new PaginationLinks({
                first: 'https://rest.calisero.ro/api/v1/messages?page=1',
                last: null,
                prev: 'https://rest.calisero.ro/api/v1/messages?page=1',
                next: 'https://rest.calisero.ro/api/v1/messages?page=3',
            }),
        );
        expect(page.meta).toEqual(
            new PaginationMeta({
                currentPage: 2,
                from: 51,
                path: 'https://rest.calisero.ro/api/v1/messages',
                perPage: 50,
                to: 52,
            }),
        );
        expect(page.hasNextPage).toBe(true);
        expect(page.responseMeta).toEqual(new ResponseMeta());
    });

    it('reads an empty last page', () => {
        const page = Paginated.fromObject(pageOf([], 'opt-outs'), Message.fromObject);

        expect(page.data).toEqual([]);
        expect(page.meta.from).toBeNull();
        expect(page.meta.to).toBeNull();
        expect(page.links.next).toBeNull();
        expect(page.hasNextPage).toBe(false);
    });

    it('names the item at fault', () => {
        expect(() =>
            Paginated.fromObject(pageOf([messageData(), { id: 'broken' }], 'messages'), Message.fromObject),
        ).toThrow('Invalid page.data[1]: "recipient" must be a string, got nothing.');
    });

    it('refuses a page without its links or meta', () => {
        const { links: _, ...withoutLinks } = pageOf([], 'messages');

        expect(() => Paginated.fromObject(withoutLinks, Message.fromObject)).toThrow(
            'Invalid page: "links" must be an object, got nothing.',
        );
        expect(() => Paginated.fromObject({ ...pageOf([], 'messages'), data: {} }, Message.fromObject)).toThrow(
            'Invalid page: "data" must be an array, got an object.',
        );
    });
});

describe('ResponseMeta.fromResponse()', () => {
    it('reads the trace id, the request rate limit and the daily limit', () => {
        const meta = ResponseMeta.fromResponse(
            new HttpResponse(201, {
                'X-Trace-Id': TRACE_ID,
                'X-RateLimit-Limit': '240',
                'X-RateLimit-Remaining': '239',
                'X-Daily-Limit': '1000',
                'X-Daily-Remaining': '872',
            }),
        );

        expect(meta).toEqual(
            new ResponseMeta({
                traceId: TRACE_ID,
                rateLimitLimit: 240,
                rateLimitRemaining: 239,
                dailyLimit: 1000,
                dailyRemaining: 872,
            }),
        );
    });

    it('reads the header names in any case', () => {
        const meta = ResponseMeta.fromResponse(
            new HttpResponse(201, { 'x-trace-id': TRACE_ID, 'x-daily-remaining': '0' }),
        );

        expect(meta.traceId).toBe(TRACE_ID);
        expect(meta.dailyRemaining).toBe(0);
    });

    it('has no daily limit when the account has none', () => {
        const meta = ResponseMeta.fromResponse(new HttpResponse(201, { 'X-RateLimit-Remaining': '12' }));

        expect(meta.dailyLimit).toBeNull();
        expect(meta.dailyRemaining).toBeNull();
        expect(meta.rateLimitRemaining).toBe(12);
    });

    it('ignores values that are not counts', () => {
        const meta = ResponseMeta.fromResponse(
            new HttpResponse(201, {
                'X-Trace-Id': '   ',
                'X-RateLimit-Limit': 'many',
                'X-RateLimit-Remaining': '-3',
                'X-Daily-Limit': '1e3',
                'X-Daily-Remaining': '99999999999999999999',
            }),
        );

        expect(meta).toEqual(new ResponseMeta());
    });

    it('trims the values', () => {
        expect(ResponseMeta.fromResponse(new HttpResponse(201, { 'X-Daily-Limit': ' 1000 ' })).dailyLimit).toBe(1000);
    });

    it('is empty without an answer', () => {
        expect(ResponseMeta.fromResponse(null)).toEqual(
            new ResponseMeta({
                traceId: null,
                rateLimitLimit: null,
                rateLimitRemaining: null,
                dailyLimit: null,
                dailyRemaining: null,
            }),
        );
    });
});
