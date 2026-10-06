import { describe, expect, it } from 'vitest';
import { OptOut, Verification } from '../../../src/index.js';
import { OPT_OUT_ID, optOutData, PHONE, VERIFICATION_ID, verificationData } from '../../support/fixtures.js';

describe('OptOut.fromObject()', () => {
    it('reads every field', () => {
        expect(OptOut.fromObject(optOutData())).toEqual(
            new OptOut({
                id: OPT_OUT_ID,
                phone: PHONE,
                reason: 'Customer asked to stop receiving messages',
                createdAt: '2025-09-19T12:01:15.000000Z',
                updatedAt: '2025-09-19T12:01:15.000000Z',
            }),
        );
    });

    it('reads an opt-out without a reason', () => {
        expect(OptOut.fromObject(optOutData({ reason: null })).reason).toBeNull();
    });

    it('names a missing required field', () => {
        expect(() => OptOut.fromObject(optOutData({ updated_at: undefined }))).toThrow(
            'Invalid opt-out: "updated_at" must be a string, got nothing.',
        );
    });
});

describe('Verification.fromObject()', () => {
    it('reads an unverified verification', () => {
        expect(Verification.fromObject(verificationData())).toEqual(
            new Verification({
                id: VERIFICATION_ID,
                phone: PHONE,
                brand: 'Calisero',
                status: 'unverified',
                template: null,
                createdAt: '2025-11-08T10:09:38.000000Z',
                expiresAt: '2025-11-08T10:12:38.000000Z',
                verifiedAt: null,
                attempts: 0,
                expired: false,
            }),
        );
    });

    it('reads a verified verification sent with a template', () => {
        const verification = Verification.fromObject(
            verificationData({
                brand: null,
                template: 'Your Calisero code is {code}',
                status: 'verified',
                verified_at: '2025-11-08T10:10:18.000000Z',
                attempts: 1,
            }),
        );

        expect(verification).toMatchObject({
            brand: null,
            template: 'Your Calisero code is {code}',
            status: 'verified',
            verifiedAt: '2025-11-08T10:10:18.000000Z',
            attempts: 1,
            expired: false,
        });
    });

    it('reads an expired verification', () => {
        expect(Verification.fromObject(verificationData({ expired: true })).expired).toBe(true);
    });

    it('names a missing required field', () => {
        expect(() => Verification.fromObject(verificationData({ expired: undefined }))).toThrow(
            'Invalid verification: "expired" must be a boolean, got nothing.',
        );
        expect(() => Verification.fromObject(verificationData({ attempts: null }))).toThrow(
            'Invalid verification: "attempts" must be an integer, got null.',
        );
    });
});
