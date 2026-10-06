import type { ApiResponse } from '../dto/ApiResponse.js';
import type { Paginated } from '../dto/Pagination.js';
import { Verification, type VerificationStatus } from '../dto/Verification.js';
import type { HttpClient, RequestOptions } from '../http/HttpClient.js';
import {
    type CreateVerificationRequest,
    createVerificationPayload,
    type VerificationCheckRequest,
    verificationCheckPayload,
} from '../requests.js';
import { type PageOptions, page, pageQuery, pathId, requestObject, single } from './support.js';

export type CreateVerificationResponse = ApiResponse<Verification>;
export type GetVerificationResponse = ApiResponse<Verification>;
export type PaginatedVerifications = Paginated<Verification>;

export interface VerificationListOptions extends PageOptions {
    /**
     * Only the verifications with this status.
     */
    readonly status?: VerificationStatus | null | undefined;
}

/**
 * Verifies phone numbers with one-time codes (OTP, 2FA).
 */
export class VerificationService {
    readonly #httpClient: HttpClient;

    constructor(httpClient: HttpClient) {
        this.#httpClient = httpClient;
    }

    /**
     * List the verifications, newest first, 50 a page.
     */
    async list(query: VerificationListOptions = {}, options: RequestOptions = {}): Promise<PaginatedVerifications> {
        const result = await this.#httpClient.get(
            '/verifications',
            { ...pageQuery(query), status: query.status ?? null },
            options,
        );

        return page(result, Verification.fromObject);
    }

    /**
     * Start a verification: Calisero generates a code and sends it by SMS.
     *
     * The code's SMS counts towards the account's daily sending limit: its
     * `responseMeta` holds what is left of it, and once it is reached the call
     * rejects with a {@link DailyLimitExceededError}.
     */
    async create(
        request: CreateVerificationRequest,
        options: RequestOptions = {},
    ): Promise<CreateVerificationResponse> {
        const payload = createVerificationPayload(requestObject(request, 'verifications.create()'));
        const result = await this.#httpClient.post('/verifications', payload, options);

        return single(result, Verification.fromObject, 'verification');
    }

    /**
     * Retrieve a verification by its id.
     */
    async get(verificationId: string, options: RequestOptions = {}): Promise<GetVerificationResponse> {
        const path = `/verifications/${pathId(verificationId, 'verification id')}`;
        const result = await this.#httpClient.get(path, {}, options);

        return single(result, Verification.fromObject, 'verification');
    }

    /**
     * Check a code against the latest verification of a phone number.
     *
     * A wrong, expired or exhausted code (5 attempts) rejects with a
     * {@link ValidationError} whose `validationErrors.code` says which; a phone
     * number without a verification with a {@link NotFoundError}. Checking a
     * verified code again succeeds.
     */
    async validate(request: VerificationCheckRequest, options: RequestOptions = {}): Promise<GetVerificationResponse> {
        const payload = verificationCheckPayload(requestObject(request, 'verifications.validate()'));
        const result = await this.#httpClient.put('/verifications/validate', payload, options);

        return single(result, Verification.fromObject, 'verification');
    }
}
