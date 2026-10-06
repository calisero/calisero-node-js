import { describe, expect, it } from 'vitest';
import { Account } from '../../../src/index.js';
import { ACCOUNT_ID, accountData } from '../../support/fixtures.js';

describe('Account.fromObject()', () => {
    it('reads every field', () => {
        expect(Account.fromObject(accountData())).toEqual(
            new Account({
                id: ACCOUNT_ID,
                code: 'ABC1234',
                name: 'My Company',
                description: 'Company description',
                fiscalCode: 'RO12345678',
                registryNumber: 'J40/123456/2023',
                iban: 'RO49AAAA1B31007593840000',
                city: 'Bucharest',
                state: 'Bucharest',
                country: 'RO',
                address: 'Main Street 123',
                postalCode: 123456,
                email: 'contact@company.com',
                phone: '+40721***456',
                contactPerson: 'John Doe',
                credit: 100.5,
                status: 'active',
                sandbox: false,
                dailyLimit: 1000,
                dailyRemaining: 873,
                sentToday: 127,
                createdAt: '2024-09-20T12:48:55.000000Z',
            }),
        );
    });

    it('reads an account with only its required fields', () => {
        const account = Account.fromObject({
            id: ACCOUNT_ID,
            code: 'ABC1234',
            name: 'My Company',
            description: null,
            fiscal_code: null,
            registry_number: null,
            iban: null,
            city: null,
            state: null,
            country: null,
            address: null,
            postal_code: null,
            email: null,
            phone: null,
            contact_person: null,
            credit: 0,
            status: 'pending',
            sandbox: true,
            created_at: '2024-09-20T12:48:55.000000Z',
        });

        expect(account).toMatchObject({
            description: null,
            fiscalCode: null,
            registryNumber: null,
            iban: null,
            city: null,
            state: null,
            country: null,
            address: null,
            postalCode: null,
            email: null,
            phone: null,
            contactPerson: null,
            credit: 0,
            status: 'pending',
            sandbox: true,
            dailyLimit: null,
            dailyRemaining: null,
            sentToday: 0,
        });
    });

    it('reads an account without a daily sending limit', () => {
        const account = Account.fromObject(accountData({ daily_limit: null, daily_remaining: null, sent_today: 42 }));

        expect(account.dailyLimit).toBeNull();
        expect(account.dailyRemaining).toBeNull();
        expect(account.sentToday).toBe(42);
    });

    it('reads a credit sent as a decimal string', () => {
        expect(Account.fromObject(accountData({ credit: '1234.5600' })).credit).toBe(1234.56);
    });

    it('refuses a credit that is not a number', () => {
        expect(() => Account.fromObject(accountData({ credit: 'a lot' }))).toThrow(
            'Invalid account: "credit" must be a number, got a string.',
        );
        expect(() => Account.fromObject(accountData({ credit: null }))).toThrow('"credit" must be a number, got null');
        expect(() => Account.fromObject(accountData({ credit: Number.NaN }))).toThrow('"credit" must be a number');
        expect(() => Account.fromObject(accountData({ credit: '' }))).toThrow('"credit" must be a number');
    });

    it('refuses a sandbox flag that is not a boolean', () => {
        expect(() => Account.fromObject(accountData({ sandbox: 1 }))).toThrow(
            'Invalid account: "sandbox" must be a boolean, got a number.',
        );
    });
});
