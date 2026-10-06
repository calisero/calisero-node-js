import { describe, expect, it } from 'vitest';
import { HttpResponse } from '../../../src/index.js';

describe('HttpResponse', () => {
    it('keeps the status and the body', () => {
        const response = new HttpResponse(201, {}, '{"data":{}}');

        expect(response.status).toBe(201);
        expect(response.body).toBe('{"data":{}}');
    });

    it('has no headers and an empty body by default', () => {
        const response = new HttpResponse(204);

        expect(response.headers).toEqual({});
        expect(response.body).toBe('');
        expect(response.getHeader('X-Trace-Id')).toEqual([]);
        expect(response.getHeaderLine('X-Trace-Id')).toBe('');
        expect(response.hasHeader('X-Trace-Id')).toBe(false);
    });

    it('matches header names case-insensitively, as HTTP defines them', () => {
        const mixedCase = new HttpResponse(200, { 'X-RateLimit-Remaining': '239' });
        const lowercase = new HttpResponse(200, { 'x-ratelimit-remaining': '239' });

        for (const response of [mixedCase, lowercase]) {
            expect(response.getHeader('X-RateLimit-Remaining')).toEqual(['239']);
            expect(response.getHeader('x-ratelimit-remaining')).toEqual(['239']);
            expect(response.getHeader('X-RATELIMIT-REMAINING')).toEqual(['239']);
            expect(response.hasHeader('X-Ratelimit-Remaining')).toBe(true);
        }
    });

    it('keeps every value of a header', () => {
        const response = new HttpResponse(200, { Vary: ['Accept', 'Origin'] });

        expect(response.getHeader('vary')).toEqual(['Accept', 'Origin']);
        expect(response.getHeaderLine('vary')).toBe('Accept, Origin');
    });

    it('merges the spellings of the same header', () => {
        const response = new HttpResponse(200, [
            ['X-Custom', 'one'],
            ['x-custom', 'two'],
        ]);

        expect(response.getHeader('X-Custom')).toEqual(['one', 'two']);
    });

    it('reads the headers of a fetch answer', () => {
        const headers = new Headers({ 'X-Trace-Id': 'abc', 'Content-Type': 'application/json' });
        const response = new HttpResponse(200, headers);

        expect(response.getHeader('x-trace-id')).toEqual(['abc']);
        expect(response.headers).toEqual({ 'content-type': ['application/json'], 'x-trace-id': ['abc'] });
    });

    it('skips headers without a value', () => {
        const response = new HttpResponse(200, { 'X-Trace-Id': undefined, 'X-Other': 'yes' });

        expect(response.hasHeader('X-Trace-Id')).toBe(false);
        expect(response.headers).toEqual({ 'x-other': ['yes'] });
    });

    it('lists the headers by lowercase name, as copies', () => {
        const response = new HttpResponse(200, { 'X-Trace-Id': 'abc' });

        response.headers['x-trace-id']?.push('tampered');
        response.getHeader('X-Trace-Id').push('tampered');

        expect(response.getHeader('X-Trace-Id')).toEqual(['abc']);
    });
});
