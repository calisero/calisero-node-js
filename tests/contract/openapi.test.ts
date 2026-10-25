import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
    Account,
    ApiError,
    DailyLimitExceededError,
    DeliveryWebhookMessage,
    ForbiddenError,
    Message,
    NotFoundError,
    OptOut,
    PaginationLinks,
    PaginationMeta,
    ServerError,
    ShortenedLink,
    type SmsClient,
    UnauthorizedError,
    ValidationError,
    Verification,
} from '../../src/index.js';
import {
    createMessagePayload,
    createVerificationPayload,
    optOutPayload,
    verificationCheckPayload,
} from '../../src/requests.js';
import { clientAnswering, jsonResponse, requestBody } from '../support/StubTransport.js';

/**
 * The SDK checked against the API's OpenAPI document (resources/openApi/api-v1.json,
 * the one published at https://docs.calisero.ro/open-api): every operation is
 * implemented and reads the documented example answers, every documented field
 * is read or sent, and every documented error maps to its error class.
 */

interface Schema {
    readonly $ref?: string;
    readonly type?: string;
    readonly properties?: Record<string, Schema>;
    readonly required?: string[];
}

interface MediaType {
    readonly schema?: Schema;
    readonly example?: unknown;
    readonly examples?: Record<string, { value: unknown }>;
}

interface ResponseObject {
    readonly $ref?: string;
    readonly content?: Record<string, MediaType>;
}

interface Operation {
    readonly operationId: string;
    readonly parameters?: { name: string; in: string }[];
    readonly requestBody?: { content: Record<string, MediaType> };
    readonly responses?: Record<string, ResponseObject>;
    // The requests Calisero sends because of the call, the delivery webhook among them:
    // by callback name, then runtime expression, then method
    readonly callbacks?: Record<string, Record<string, Record<string, Operation>>>;
}

interface OpenApi {
    readonly info: { version: string };
    readonly servers: { url: string }[];
    readonly paths: Record<string, Record<string, Operation>>;
    readonly components: {
        readonly schemas: Record<string, Schema>;
        readonly responses: Record<string, ResponseObject>;
    };
}

const spec = JSON.parse(
    readFileSync(new URL('../../resources/openApi/api-v1.json', import.meta.url), 'utf8'),
) as OpenApi;

function resolve<T extends { $ref?: string }>(value: T): T {
    if (value.$ref === undefined) {
        return value;
    }

    const [, , section, name] = value.$ref.split('/');
    const components = spec.components as unknown as Record<string, Record<string, T>>;
    const resolved = section && name ? components[section]?.[name] : undefined;

    if (resolved === undefined) {
        throw new Error(`Cannot resolve ${value.$ref}`);
    }

    return resolve(resolved);
}

function examplesOf(response: ResponseObject): unknown[] {
    const media = resolve(response).content?.['application/json'];

    if (media === undefined) {
        return [];
    }

    return media.example !== undefined
        ? [media.example]
        : Object.values(media.examples ?? {}).map((example) => example.value);
}

/**
 * The examples of a successful answer; for one documented by its schema alone,
 * those of the other answers with the same schema.
 */
function successExamples(response: ResponseObject): unknown[] {
    const own = examplesOf(response);
    const schema = resolve(response).content?.['application/json']?.schema?.$ref;

    if (own.length > 0 || schema === undefined) {
        return own;
    }

    return Object.values(spec.paths)
        .flatMap((methods) => Object.values(methods))
        .flatMap((operation) => Object.values(operation.responses ?? {}))
        .filter((other) => resolve(other).content?.['application/json']?.schema?.$ref === schema)
        .flatMap(examplesOf);
}

function propertiesOf(schemaName: string): string[] {
    return Object.keys(resolve(spec.components.schemas[schemaName] ?? {}).properties ?? {});
}

const camelCase = (name: string): string => name.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

const ID = '019a62f1-66b7-7387-a64f-2742c12a2860';
const PHONE = '+40742***350';

/**
 * How the SDK calls each operation of the API, by operationId.
 */
const calls: Record<string, { readonly call: (client: SmsClient) => Promise<unknown>; readonly query?: string }> = {
    getAccount: { call: (client) => client.accounts.get(ID) },
    createMessage: {
        call: (client) =>
            client.messages.create({
                recipient: PHONE,
                body: 'Test message',
                visibleBody: 'Test ******',
                validity: 72,
                scheduleAt: '2026-11-16 13:21:00',
                callbackUrl: 'https://yoursite.com/your-callback-url',
                sender: 'CALISERO',
                shortenUrls: true,
            }),
    },
    listMessages: { call: (client) => client.messages.list({ page: 2 }), query: 'page=2' },
    getMessage: { call: (client) => client.messages.get(ID) },
    deleteMessage: { call: (client) => client.messages.delete(ID) },
    listOptOuts: { call: (client) => client.optOuts.list({ page: 2 }), query: 'page=2' },
    createOptOut: { call: (client) => client.optOuts.create({ phone: PHONE, reason: 'Unsubscribed' }) },
    getOptOut: { call: (client) => client.optOuts.get(ID) },
    updateOptOut: { call: (client) => client.optOuts.update(ID, { phone: PHONE, reason: 'Unsubscribed' }) },
    deleteOptOut: { call: (client) => client.optOuts.delete(ID) },
    listVerifications: {
        call: (client) => client.verifications.list({ page: 2, status: 'verified' }),
        query: 'page=2&status=verified',
    },
    createVerification: {
        call: (client) =>
            client.verifications.create({ phone: PHONE, brand: 'Calisero', template: 'Code: {code}', expiresIn: 5 }),
    },
    getVerification: { call: (client) => client.verifications.get(ID) },
    validateVerificationPost: { call: (client) => client.verifications.validate({ phone: PHONE, code: 'SBMH0f' }) },
};

// The delivery webhook, which Calisero sends rather than answers, is a callback of POST /messages, not one of these
const operations = Object.entries(spec.paths).flatMap(([path, methods]) =>
    Object.entries(methods).map(([method, operation]) => ({ path, method: method.toUpperCase(), operation })),
);

describe('the OpenAPI document', () => {
    it('is the version this SDK was built for', () => {
        expect(spec.info.version).toMatch(/^1\.0\.15\b/);
        expect(spec.servers[0]?.url).toBe('https://rest.calisero.ro/api/v1');
    });

    it('documents no operation the SDK lacks, and the SDK calls none it does not document', () => {
        expect(operations.map(({ operation }) => operation.operationId).sort()).toEqual(Object.keys(calls).sort());
    });
});

describe.each(operations)('$method $path', ({ path, method, operation }) => {
    const sdk = calls[operation.operationId];
    const [status, success] = Object.entries(operation.responses ?? {}).find(([code]) => code.startsWith('2')) ?? [];

    it('is called with the documented method, path and query', async () => {
        const { client, transport } = clientAnswering(jsonResponse(Number(status), successExamples(success ?? {})[0]));

        await sdk?.call(client);

        const url = new URL(transport.lastRequest.url);
        const expectedPath = `/api/v1${path.replace(/\{[^}]+\}/g, ID)}`;
        expect(transport.lastRequest.method).toBe(method);
        expect(url.pathname).toBe(expectedPath);
        expect(url.search).toBe(sdk?.query ? `?${sdk.query}` : '');
    });

    it('reads the documented answer', async () => {
        const examples = successExamples(success ?? {});
        expect(examples.length).toBeGreaterThan(0);

        for (const example of examples) {
            const { client } = clientAnswering(jsonResponse(Number(status), example));

            // Rejects, failing the test, when the SDK cannot read the example
            await sdk?.call(client);
        }
    });

    if (operation.requestBody !== undefined) {
        it('sends only documented fields, the required ones included', async () => {
            const schema = resolve(operation.requestBody?.content['application/json']?.schema ?? {});
            const { client, transport } = clientAnswering(
                jsonResponse(Number(status), successExamples(success ?? {})[0]),
            );

            await sdk?.call(client);

            const sent = Object.keys(requestBody(transport.lastRequest) as object);
            expect(Object.keys(schema.properties ?? {})).toEqual(expect.arrayContaining(sent));
            expect(sent).toEqual(expect.arrayContaining(schema.required ?? []));
        });
    }
});

describe('documented resources', () => {
    it.each([
        ['Message', () => Message.fromObject(documentedData('/messages', 'post', '201'))],
        ['ShortenedLink', () => ShortenedLink.fromObject(shortenedLinkExample())],
        ['OptOut', () => OptOut.fromObject(documentedData('/opt-outs', 'post', '201'))],
        ['Account', () => Account.fromObject(documentedData('/accounts/{accountId}', 'get', '200'))],
        ['Verification', () => Verification.fromObject(documentedData('/verifications', 'post', '201'))],
    ])('%s: every documented field is read', (schemaName, read) => {
        const dto = read();

        for (const property of propertiesOf(schemaName)) {
            expect(dto, `${schemaName}.${property}`).toHaveProperty(camelCase(property));
        }
    });

    it('pagination: every documented field of the links and the meta is read', () => {
        const page = documentedAnswer('/messages', 'get', '200') as Record<string, unknown>;
        const links = PaginationLinks.fromObject(page.links);
        const meta = PaginationMeta.fromObject(page.meta);
        const schema = resolve(spec.components.schemas.PaginatedMessages ?? {});

        for (const property of Object.keys(schema.properties?.links?.properties ?? {})) {
            expect(links).toHaveProperty(camelCase(property));
        }

        for (const property of Object.keys(schema.properties?.meta?.properties ?? {})) {
            expect(meta).toHaveProperty(camelCase(property));
        }
    });

    it('delivery webhook: the documented payload is read, every field of it', () => {
        const webhook =
            spec.paths['/messages']?.post?.callbacks?.deliveryStatus?.['{$request.body#/callback_url}']?.post;
        const example = webhook?.requestBody?.content['application/json']?.example as Record<string, unknown>;
        const message = DeliveryWebhookMessage.fromObject(example);

        for (const property of propertiesOf('DeliveryWebhookMessage')) {
            expect(message[property as keyof DeliveryWebhookMessage], property).toEqual(example[property]);
        }
    });
});

describe('documented requests', () => {
    it.each([
        [
            'CreateMessageRequest',
            createMessagePayload({
                recipient: PHONE,
                body: 'b',
                visibleBody: 'v',
                validity: 1,
                scheduleAt: new Date(),
                callbackUrl: 'https://yoursite.com',
                sender: 's',
                shortenUrls: true,
            }),
        ],
        ['CreateOptOutRequest', optOutPayload({ phone: PHONE, reason: 'r' })],
        ['UpdateOptOutRequest', optOutPayload({ phone: PHONE, reason: 'r' })],
        [
            'CreateVerificationRequest',
            createVerificationPayload({ phone: PHONE, brand: 'b', template: '{code}', expiresIn: 5 }),
        ],
        ['VerificationCheckRequest', verificationCheckPayload({ phone: PHONE, code: 'ABC123' })],
    ])('%s: the SDK can send every documented field', (schemaName, payload) => {
        expect(Object.keys(payload).sort()).toEqual(propertiesOf(schemaName).sort());
    });
});

describe('documented errors', () => {
    const errorClasses: Record<string, typeof ApiError> = {
        '401': UnauthorizedError,
        '403': ForbiddenError,
        '404': NotFoundError,
        '405': ApiError,
        '422': ValidationError,
        '429': DailyLimitExceededError,
        '500': ServerError,
    };

    const documented = operations.flatMap(({ operation }) =>
        Object.entries(operation.responses ?? {})
            .filter(([status]) => !status.startsWith('2'))
            .flatMap(([status, response]) =>
                examplesOf(response).map((example) => ({ operationId: operation.operationId, status, example })),
            ),
    );

    it('are all mapped', () => {
        expect(new Set(documented.map(({ status }) => status))).toEqual(new Set(Object.keys(errorClasses)));
    });

    it.each(documented)('$operationId $status', async ({ operationId, status, example }) => {
        const { client } = clientAnswering(jsonResponse(Number(status), example));

        const error = await calls[operationId]?.call(client).catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(errorClasses[status]);
        expect((error as ApiError).statusCode).toBe(Number(status));
        expect((error as ApiError).message).toBe((example as { message: string }).message);
    });
});

/**
 * The first documented example of an answer.
 */
function documentedAnswer(path: string, method: string, status: string): unknown {
    const response = spec.paths[path]?.[method]?.responses?.[status];
    const example = response === undefined ? undefined : examplesOf(response)[0];

    if (example === undefined) {
        throw new Error(`No example documented for the ${status} answer of ${method.toUpperCase()} ${path}`);
    }

    return example;
}

/**
 * The resource (`data`) of the first documented example of an answer.
 */
function documentedData(path: string, method: string, status: string): unknown {
    return (documentedAnswer(path, method, status) as { data: unknown }).data;
}

function shortenedLinkExample(): unknown {
    const message = documentedData('/messages', 'post', '201') as { shortened_urls: unknown[] };

    return message.shortened_urls[0];
}
