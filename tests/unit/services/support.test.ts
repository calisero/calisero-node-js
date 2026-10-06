import { describe, expect, it } from 'vitest';
import { ApiError, HttpResponse } from '../../../src/index.js';
import { page, pageQuery, pathId, requestObject, single } from '../../../src/services/support.js';

const result = (body: unknown) => ({ body, response: new HttpResponse(200, { 'X-Trace-Id': 'trace-1' }) });

describe('service helpers', () => {
    it('single() reads the resource and the answer headers', () => {
        const response = single(result({ data: { id: 'x' } }), (data) => data, 'thing');

        expect(response.data).toEqual({ id: 'x' });
        expect(response.responseMeta.traceId).toBe('trace-1');
    });

    it('turns a malformed answer into an ApiError, and lets any other error through', () => {
        expect(() => single(result({}), (data) => data, 'thing')).toThrow(
            new ApiError('Unexpected API response: Invalid thing answer: "data" must be an object, got nothing.', {
                statusCode: 200,
                traceId: 'trace-1',
            }),
        );
        expect(() => page(result([]), (data) => data)).toThrow(ApiError);

        const failure = new RangeError('Not a type error');

        expect(() =>
            single(
                result({ data: {} }),
                () => {
                    throw failure;
                },
                'thing',
            ),
        ).toThrow(failure);
    });

    it('pageQuery() sends the page from the second one on', () => {
        expect(pageQuery({})).toEqual({});
        expect(pageQuery({ page: undefined })).toEqual({});
        expect(pageQuery({ page: null as unknown as number })).toEqual({});
        expect(pageQuery({ page: 1 })).toEqual({});
        expect(pageQuery({ page: 7 })).toEqual({ page: 7 });
        expect(() => pageQuery({ page: 0 })).toThrow(new RangeError('The page must be a positive integer, got 0.'));
    });

    it('pathId() encodes an id and refuses an empty one', () => {
        expect(pathId('019a62f1-66b7-7387-a64f-2742c12a2860', 'id')).toBe('019a62f1-66b7-7387-a64f-2742c12a2860');
        expect(pathId('a/b c', 'id')).toBe('a%2Fb%20c');
        expect(() => pathId('', 'message id')).toThrow(new TypeError('The message id must be a non-empty string.'));
        expect(() => pathId(42 as unknown as string, 'message id')).toThrow(TypeError);
    });

    it('requestObject() refuses what is not a request object', () => {
        const request = { phone: '+40742***350' };

        expect(requestObject(request, 'call()')).toBe(request);
        expect(() => requestObject([] as unknown as object, 'call()')).toThrow('call() needs a request object.');
        expect(() => requestObject('phone' as unknown as object, 'call()')).toThrow(TypeError);
    });
});
