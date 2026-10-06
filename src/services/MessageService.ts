import type { ApiResponse } from '../dto/ApiResponse.js';
import { Message } from '../dto/Message.js';
import type { Paginated } from '../dto/Pagination.js';
import type { HttpClient, RequestOptions } from '../http/HttpClient.js';
import { type CreateMessageRequest, createMessagePayload } from '../requests.js';
import { type PageOptions, page, pageQuery, pathId, requestObject, single } from './support.js';

export type CreateMessageResponse = ApiResponse<Message>;
export type GetMessageResponse = ApiResponse<Message>;
export type PaginatedMessages = Paginated<Message>;

/**
 * Sends and manages SMS messages.
 */
export class MessageService {
    readonly #httpClient: HttpClient;

    constructor(httpClient: HttpClient) {
        this.#httpClient = httpClient;
    }

    /**
     * Send a message, now or at `scheduleAt`.
     *
     * Its `responseMeta` holds what is left of the account's daily sending limit
     * after this message. Once the limit is reached the call rejects with a
     * {@link DailyLimitExceededError}; a refused recipient (invalid, or opted out)
     * with a {@link ValidationError}.
     */
    async create(request: CreateMessageRequest, options: RequestOptions = {}): Promise<CreateMessageResponse> {
        const payload = createMessagePayload(requestObject(request, 'messages.create()'));
        const result = await this.#httpClient.post('/messages', payload, options);

        return single(result, Message.fromObject, 'message');
    }

    /**
     * Retrieve a message by its id.
     */
    async get(messageId: string, options: RequestOptions = {}): Promise<GetMessageResponse> {
        const result = await this.#httpClient.get(`/messages/${pathId(messageId, 'message id')}`, {}, options);

        return single(result, Message.fromObject, 'message');
    }

    /**
     * List the messages, newest first, 50 a page.
     */
    async list(query: PageOptions = {}, options: RequestOptions = {}): Promise<PaginatedMessages> {
        const result = await this.#httpClient.get('/messages', pageQuery(query), options);

        return page(result, Message.fromObject);
    }

    /**
     * Cancel a scheduled message. A message already queued, sent or delivered
     * cannot be: the call then rejects with a {@link ForbiddenError}.
     */
    async delete(messageId: string, options: RequestOptions = {}): Promise<void> {
        await this.#httpClient.delete(`/messages/${pathId(messageId, 'message id')}`, options);
    }
}
