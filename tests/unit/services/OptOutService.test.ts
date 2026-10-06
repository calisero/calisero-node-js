import { describe, expect, it } from 'vitest';
import { NotFoundError, OptOut, ValidationError } from '../../../src/index.js';
import { OPT_OUT_ID, optOutData, PHONE, pageOf } from '../../support/fixtures.js';
import { clientAnswering, jsonResponse, requestBody } from '../../support/StubTransport.js';

const BASE = 'https://rest.calisero.ro/api/v1';

describe('OptOutService', () => {
    it('creates an opt-out with a reason', async () => {
        const { client, transport } = clientAnswering(jsonResponse(201, { data: optOutData() }));

        const response = await client.optOuts.create({
            phone: PHONE,
            reason: 'Customer asked to stop receiving messages',
        });

        expect(transport.lastRequest.method).toBe('POST');
        expect(transport.lastRequest.url).toBe(`${BASE}/opt-outs`);
        expect(requestBody(transport.lastRequest)).toEqual({
            phone: PHONE,
            reason: 'Customer asked to stop receiving messages',
        });
        expect(response.data).toBeInstanceOf(OptOut);
        expect(response.data.id).toBe(OPT_OUT_ID);
    });

    it('creates an opt-out without a reason', async () => {
        const { client, transport } = clientAnswering(jsonResponse(201, { data: optOutData({ reason: null }) }));

        const response = await client.optOuts.create({ phone: PHONE });

        expect(requestBody(transport.lastRequest)).toEqual({ phone: PHONE });
        expect(response.data.reason).toBeNull();
    });

    it('rejects with a ValidationError for a number already opted out', async () => {
        const { client } = clientAnswering(
            jsonResponse(422, {
                message: 'The phone has already been taken.',
                errors: { phone: ['The phone has already been taken.'] },
            }),
        );

        const error = await client.optOuts.create({ phone: PHONE, reason: 'Again' }).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).validationErrors.phone).toEqual(['The phone has already been taken.']);
    });

    it('retrieves an opt-out by its id', async () => {
        const { client, transport } = clientAnswering(jsonResponse(200, { data: optOutData() }));

        const response = await client.optOuts.get(OPT_OUT_ID);

        expect(transport.lastRequest.method).toBe('GET');
        expect(transport.lastRequest.url).toBe(`${BASE}/opt-outs/${OPT_OUT_ID}`);
        expect(response.data.phone).toBe(PHONE);
    });

    it('rejects with a NotFoundError for an unknown opt-out', async () => {
        const { client } = clientAnswering(jsonResponse(404, { message: 'Resource not found!' }));

        await expect(client.optOuts.get(OPT_OUT_ID)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('lists the first page, a later page and an empty list', async () => {
        const { client, transport } = clientAnswering(
            jsonResponse(200, pageOf([optOutData(), optOutData({ id: 'second', reason: null })], 'opt-outs', 1, true)),
            jsonResponse(200, pageOf([optOutData()], 'opt-outs', 3)),
            jsonResponse(200, pageOf([], 'opt-outs')),
        );

        const first = await client.optOuts.list();
        const third = await client.optOuts.list({ page: 3 });
        const empty = await client.optOuts.list();

        expect(transport.requests.map((request) => request.url)).toEqual([
            `${BASE}/opt-outs`,
            `${BASE}/opt-outs?page=3`,
            `${BASE}/opt-outs`,
        ]);
        expect(first.data.map((optOut) => optOut.reason)).toEqual(['Customer asked to stop receiving messages', null]);
        expect(first.hasNextPage).toBe(true);
        expect(third.meta.currentPage).toBe(3);
        expect(empty.data).toEqual([]);
    });

    it('updates an opt-out', async () => {
        const { client, transport } = clientAnswering(
            jsonResponse(200, {
                data: optOutData({ reason: 'Confirmed by phone', updated_at: '2025-09-20T08:00:00.000000Z' }),
            }),
        );

        const response = await client.optOuts.update(OPT_OUT_ID, { phone: PHONE, reason: 'Confirmed by phone' });

        expect(transport.lastRequest.method).toBe('PUT');
        expect(transport.lastRequest.url).toBe(`${BASE}/opt-outs/${OPT_OUT_ID}`);
        expect(requestBody(transport.lastRequest)).toEqual({ phone: PHONE, reason: 'Confirmed by phone' });
        expect(response.data.reason).toBe('Confirmed by phone');
        expect(response.data.updatedAt).toBe('2025-09-20T08:00:00.000000Z');
    });

    it('updates an opt-out without a reason', async () => {
        const { client, transport } = clientAnswering(jsonResponse(200, { data: optOutData({ reason: null }) }));

        await client.optOuts.update(OPT_OUT_ID, { phone: PHONE });

        expect(requestBody(transport.lastRequest)).toEqual({ phone: PHONE });
    });

    it('deletes an opt-out', async () => {
        const { client, transport } = clientAnswering(jsonResponse(200, []));

        await expect(client.optOuts.delete(OPT_OUT_ID)).resolves.toBeUndefined();

        expect(transport.lastRequest.method).toBe('DELETE');
        expect(transport.lastRequest.url).toBe(`${BASE}/opt-outs/${OPT_OUT_ID}`);
    });

    it('refuses an empty id or a missing request without sending anything', async () => {
        const { client, transport } = clientAnswering();

        await expect(client.optOuts.get('')).rejects.toThrow('The opt-out id must be a non-empty string.');
        await expect(client.optOuts.delete('')).rejects.toThrow(TypeError);
        await expect(client.optOuts.update('', { phone: PHONE })).rejects.toThrow(TypeError);
        // @ts-expect-error a JavaScript caller may forget the request
        await expect(client.optOuts.update(OPT_OUT_ID)).rejects.toThrow('optOuts.update() needs a request object.');
        // @ts-expect-error a JavaScript caller may forget the request
        await expect(client.optOuts.create(null)).rejects.toThrow('optOuts.create() needs a request object.');
        expect(transport.requests).toHaveLength(0);
    });
});
