import type { HttpResult } from '../http/HttpClient.js';
import { FieldReader } from '../internal/FieldReader.js';
import { ResponseMeta } from './ResponseMeta.js';

export interface PaginationLinksProps {
    readonly first: string | null;
    readonly last: string | null;
    readonly prev: string | null;
    readonly next: string | null;
}

/**
 * The URLs of the neighbouring pages; null when there is none.
 */
export class PaginationLinks implements PaginationLinksProps {
    readonly first: string | null;

    /**
     * Always null: the API does not count the pages.
     */
    readonly last: string | null;

    readonly prev: string | null;

    /**
     * Null on the last page.
     */
    readonly next: string | null;

    constructor(props: PaginationLinksProps) {
        this.first = props.first;
        this.last = props.last;
        this.prev = props.prev;
        this.next = props.next;
    }

    static fromObject(data: unknown, context = 'pagination links'): PaginationLinks {
        const read = FieldReader.of(data, context);

        return new PaginationLinks({
            first: read.optionalString('first'),
            last: read.optionalString('last'),
            prev: read.optionalString('prev'),
            next: read.optionalString('next'),
        });
    }
}

export interface PaginationMetaProps {
    readonly currentPage: number;
    readonly from: number | null;
    readonly path: string;
    readonly perPage: number;
    readonly to: number | null;
}

/**
 * Where the page stands in the whole list.
 */
export class PaginationMeta implements PaginationMetaProps {
    readonly currentPage: number;

    /**
     * The position of the page's first item in the whole list; null on an empty page.
     */
    readonly from: number | null;

    readonly path: string;
    readonly perPage: number;

    /**
     * The position of the page's last item in the whole list; null on an empty page.
     */
    readonly to: number | null;

    constructor(props: PaginationMetaProps) {
        this.currentPage = props.currentPage;
        this.from = props.from;
        this.path = props.path;
        this.perPage = props.perPage;
        this.to = props.to;
    }

    static fromObject(data: unknown, context = 'pagination meta'): PaginationMeta {
        const read = FieldReader.of(data, context);

        return new PaginationMeta({
            currentPage: read.integer('current_page'),
            from: read.optionalInteger('from'),
            path: read.string('path'),
            perPage: read.integer('per_page'),
            to: read.optionalInteger('to'),
        });
    }
}

/**
 * A page of a list: its items, the links to the other pages and where it stands.
 */
export class Paginated<T> {
    readonly data: readonly T[];
    readonly links: PaginationLinks;
    readonly meta: PaginationMeta;

    /**
     * The answer's headers: trace id and request rate limit.
     */
    readonly responseMeta: ResponseMeta;

    constructor(data: readonly T[], links: PaginationLinks, meta: PaginationMeta, responseMeta = new ResponseMeta()) {
        this.data = data;
        this.links = links;
        this.meta = meta;
        this.responseMeta = responseMeta;
    }

    /**
     * Whether a next page exists.
     */
    get hasNextPage(): boolean {
        return this.links.next !== null;
    }

    /**
     * Read a page as the API sends it, each item with `item`.
     *
     * @throws {TypeError} when a required field is missing or malformed
     */
    static fromObject<T>(
        data: unknown,
        item: (data: unknown, context: string) => T,
        context = 'page',
        responseMeta = new ResponseMeta(),
    ): Paginated<T> {
        const read = FieldReader.of(data, context);

        return new Paginated(
            read.array('data').map((entry, index) => item(entry, `${context}.data[${index}]`)),
            PaginationLinks.fromObject(read.object('links'), `${context}.links`),
            PaginationMeta.fromObject(read.object('meta'), `${context}.meta`),
            responseMeta,
        );
    }

    /**
     * @internal
     */
    static fromResult<T>(result: HttpResult, item: (data: unknown, context: string) => T): Paginated<T> {
        return Paginated.fromObject(result.body, item, 'page', ResponseMeta.fromResponse(result.response));
    }
}
