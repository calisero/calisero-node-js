import { describe, expect, it } from 'vitest';
import { DailyLimitExceededError, NotFoundError, ValidationError, Verification } from '../../../src/index.js';
import {
    DAILY_LIMIT_BODY,
    PHONE,
    pageOf,
    TRACE_ID,
    VERIFICATION_ID,
    verificationData,
} from '../../support/fixtures.js';
import { clientAnswering, jsonResponse, requestBody } from '../../support/StubTransport.js';

const BASE = 'https://rest.calisero.ro/api/v1';

describe('VerificationService.list()', () => {
    it('lists the first page', async () => {
        const { client, transport } = clientAnswering(
            jsonResponse(200, pageOf([verificationData({ status: 'verified' })], 'verifications')),
        );

        const page = await client.verifications.list();

        expect(transport.lastRequest.url).toBe(`${BASE}/verifications`);
        expect(page.data[0]).toBeInstanceOf(Verification);
        expect(page.data[0]?.status).toBe('verified');
    });

    it('filters by status and reads a later page', async () => {
        const { client, transport } = clientAnswering(
            jsonResponse(200, pageOf([verificationData()], 'verifications', 2)),
            jsonResponse(200, pageOf([], 'verifications')),
        );

        await client.verifications.list({ page: 2, status: 'unverified' });
        await client.verifications.list({ status: null });

        expect(transport.requests.map((request) => request.url)).toEqual([
            `${BASE}/verifications?page=2&status=unverified`,
            `${BASE}/verifications`,
        ]);
    });
});

describe('VerificationService.create()', () => {
    it('starts a verification with a brand', async () => {
        const { client, transport } = clientAnswering(
            jsonResponse(
                201,
                { data: verificationData() },
                { 'X-Trace-Id': TRACE_ID, 'X-Daily-Limit': '1000', 'X-Daily-Remaining': '871' },
            ),
        );

        const response = await client.verifications.create({ phone: PHONE, brand: 'Calisero' });

        expect(transport.lastRequest.method).toBe('POST');
        expect(transport.lastRequest.url).toBe(`${BASE}/verifications`);
        expect(requestBody(transport.lastRequest)).toEqual({ phone: PHONE, brand: 'Calisero' });
        expect(response.data.id).toBe(VERIFICATION_ID);
        expect(response.data.status).toBe('unverified');
        expect(response.responseMeta).toMatchObject({ traceId: TRACE_ID, dailyLimit: 1000, dailyRemaining: 871 });
    });

    it('starts a verification with a template and an expiry', async () => {
        const { client, transport } = clientAnswering(
            jsonResponse(201, { data: verificationData({ brand: null, template: 'Your code: {code}' }) }),
        );

        const { data: verification } = await client.verifications.create({
            phone: PHONE,
            template: 'Your code: {code}',
            expiresIn: 10,
        });

        expect(requestBody(transport.lastRequest)).toEqual({
            phone: PHONE,
            template: 'Your code: {code}',
            expires_in: 10,
        });
        expect(verification.template).toBe('Your code: {code}');
    });

    it('rejects with a DailyLimitExceededError once the daily limit is reached', async () => {
        const { client } = clientAnswering(jsonResponse(429, DAILY_LIMIT_BODY));

        await expect(client.verifications.create({ phone: PHONE, brand: 'Calisero' })).rejects.toBeInstanceOf(
            DailyLimitExceededError,
        );
    });

    it('refuses a missing request without sending anything', async () => {
        const { client, transport } = clientAnswering();

        // @ts-expect-error a JavaScript caller may forget the request
        await expect(client.verifications.create()).rejects.toThrow('verifications.create() needs a request object.');
        expect(transport.requests).toHaveLength(0);
    });
});

describe('VerificationService.get()', () => {
    it('retrieves a verification by its id', async () => {
        const { client, transport } = clientAnswering(
            jsonResponse(200, {
                data: verificationData({ status: 'verified', verified_at: '2025-11-08T10:10:18.000000Z', attempts: 1 }),
            }),
        );

        const { data: verification } = await client.verifications.get(VERIFICATION_ID);

        expect(transport.lastRequest.url).toBe(`${BASE}/verifications/${VERIFICATION_ID}`);
        expect(verification.verifiedAt).toBe('2025-11-08T10:10:18.000000Z');
        expect(verification.attempts).toBe(1);
    });

    it('refuses an empty id without sending anything', async () => {
        const { client, transport } = clientAnswering();

        await expect(client.verifications.get('')).rejects.toThrow('The verification id must be a non-empty string.');
        expect(transport.requests).toHaveLength(0);
    });
});

describe('VerificationService.validate()', () => {
    it('validates a code with a PUT', async () => {
        const { client, transport } = clientAnswering(
            jsonResponse(200, {
                data: verificationData({ status: 'verified', verified_at: '2025-11-08T10:10:18.000000Z', attempts: 1 }),
            }),
        );

        const { data: verification } = await client.verifications.validate({ phone: PHONE, code: 'ABC123' });

        expect(transport.lastRequest.method).toBe('PUT');
        expect(transport.lastRequest.url).toBe(`${BASE}/verifications/validate`);
        expect(requestBody(transport.lastRequest)).toEqual({ phone: PHONE, code: 'ABC123' });
        expect(verification.status).toBe('verified');
    });

    it.each([
        'The validation code is incorrect.',
        'The validation code has expired.',
        'The maximum number of verification attempts has been exceeded.',
    ])('rejects with a ValidationError: %s', async (message) => {
        const { client } = clientAnswering(jsonResponse(422, { message, errors: { code: [message] } }));

        const error = await client.verifications.validate({ phone: PHONE, code: 'WRONG1' }).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).message).toBe(message);
        expect((error as ValidationError).validationErrors).toEqual({ code: [message] });
    });

    it('rejects with a NotFoundError when the phone has no verification', async () => {
        const { client } = clientAnswering(jsonResponse(404, { message: 'Resource not found!' }));

        await expect(client.verifications.validate({ phone: PHONE, code: 'ABC123' })).rejects.toBeInstanceOf(
            NotFoundError,
        );
    });
});
