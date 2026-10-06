import { Account } from '../dto/Account.js';
import type { ApiResponse } from '../dto/ApiResponse.js';
import type { HttpClient, RequestOptions } from '../http/HttpClient.js';
import { pathId, single } from './support.js';

export type GetAccountResponse = ApiResponse<Account>;

/**
 * Reads the account: credit, status and daily sending limit.
 */
export class AccountService {
    readonly #httpClient: HttpClient;

    constructor(httpClient: HttpClient) {
        this.#httpClient = httpClient;
    }

    /**
     * Retrieve an account by its id.
     */
    async get(accountId: string, options: RequestOptions = {}): Promise<GetAccountResponse> {
        const result = await this.#httpClient.get(`/accounts/${pathId(accountId, 'account id')}`, {}, options);

        return single(result, Account.fromObject, 'account');
    }
}
