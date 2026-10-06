import type { ApiResponse } from '../dto/ApiResponse.js';
import { OptOut } from '../dto/OptOut.js';
import type { Paginated } from '../dto/Pagination.js';
import type { HttpClient, RequestOptions } from '../http/HttpClient.js';
import { type CreateOptOutRequest, optOutPayload, type UpdateOptOutRequest } from '../requests.js';
import { type PageOptions, page, pageQuery, pathId, requestObject, single } from './support.js';

export type CreateOptOutResponse = ApiResponse<OptOut>;
export type GetOptOutResponse = ApiResponse<OptOut>;
export type PaginatedOptOuts = Paginated<OptOut>;

/**
 * Manages the phone numbers that opted out of receiving messages. The API refuses
 * to send to an opted-out number.
 */
export class OptOutService {
    readonly #httpClient: HttpClient;

    constructor(httpClient: HttpClient) {
        this.#httpClient = httpClient;
    }

    /**
     * Opt a phone number out.
     */
    async create(request: CreateOptOutRequest, options: RequestOptions = {}): Promise<CreateOptOutResponse> {
        const payload = optOutPayload(requestObject(request, 'optOuts.create()'));
        const result = await this.#httpClient.post('/opt-outs', payload, options);

        return single(result, OptOut.fromObject, 'opt-out');
    }

    /**
     * Retrieve an opt-out by its id.
     */
    async get(optOutId: string, options: RequestOptions = {}): Promise<GetOptOutResponse> {
        const result = await this.#httpClient.get(`/opt-outs/${pathId(optOutId, 'opt-out id')}`, {}, options);

        return single(result, OptOut.fromObject, 'opt-out');
    }

    /**
     * List the opt-outs, 50 a page.
     */
    async list(query: PageOptions = {}, options: RequestOptions = {}): Promise<PaginatedOptOuts> {
        const result = await this.#httpClient.get('/opt-outs', pageQuery(query), options);

        return page(result, OptOut.fromObject);
    }

    /**
     * Update an opt-out.
     */
    async update(
        optOutId: string,
        request: UpdateOptOutRequest,
        options: RequestOptions = {},
    ): Promise<GetOptOutResponse> {
        const path = `/opt-outs/${pathId(optOutId, 'opt-out id')}`;
        const payload = optOutPayload(requestObject(request, 'optOuts.update()'));
        const result = await this.#httpClient.put(path, payload, options);

        return single(result, OptOut.fromObject, 'opt-out');
    }

    /**
     * Delete an opt-out: the number can receive messages again.
     */
    async delete(optOutId: string, options: RequestOptions = {}): Promise<void> {
        await this.#httpClient.delete(`/opt-outs/${pathId(optOutId, 'opt-out id')}`, options);
    }
}
