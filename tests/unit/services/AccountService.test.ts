import { describe, expect, it } from 'vitest';
import { Account, ForbiddenError, UnauthorizedError } from '../../../src/index.js';
import { ACCOUNT_ID, accountData, TRACE_ID } from '../../support/fixtures.js';
import { clientAnswering, jsonResponse } from '../../support/StubTransport.js';

describe('AccountService.get()', () => {
    it('retrieves an account by its id', async () => {
        const { client, transport } = clientAnswering(
            jsonResponse(200, { data: accountData() }, { 'X-Trace-Id': TRACE_ID }),
        );

        const response = await client.accounts.get(ACCOUNT_ID);

        expect(transport.lastRequest.method).toBe('GET');
        expect(transport.lastRequest.url).toBe(`https://rest.calisero.ro/api/v1/accounts/${ACCOUNT_ID}`);
        expect(response.data).toBeInstanceOf(Account);
        expect(response.data).toMatchObject({
            name: 'My Company',
            credit: 100.5,
            status: 'active',
            sandbox: false,
            dailyLimit: 1000,
            dailyRemaining: 873,
            sentToday: 127,
        });
        expect(response.responseMeta.traceId).toBe(TRACE_ID);
    });

    it('retrieves a sandbox account without a daily limit and with low credit', async () => {
        const { client } = clientAnswering(
            jsonResponse(200, {
                data: accountData({ sandbox: true, credit: 0.25, daily_limit: null, daily_remaining: null }),
            }),
        );

        const { data: account } = await client.accounts.get(ACCOUNT_ID);

        expect(account.sandbox).toBe(true);
        expect(account.credit).toBe(0.25);
        expect(account.dailyLimit).toBeNull();
        expect(account.dailyRemaining).toBeNull();
    });

    it('rejects with a ForbiddenError for another account', async () => {
        const { client } = clientAnswering(
            jsonResponse(403, { message: 'You are not authorized to view this resource!' }),
        );

        await expect(client.accounts.get('another-account')).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('rejects with an UnauthorizedError for an invalid key', async () => {
        const { client } = clientAnswering(jsonResponse(401, { message: 'Unauthenticated.' }));

        await expect(client.accounts.get(ACCOUNT_ID)).rejects.toThrow(UnauthorizedError);
    });

    it('refuses an empty id without sending anything', async () => {
        const { client, transport } = clientAnswering();

        await expect(client.accounts.get('')).rejects.toThrow('The account id must be a non-empty string.');
        expect(transport.requests).toHaveLength(0);
    });
});
