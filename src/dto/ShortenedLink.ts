import { FieldReader } from '../internal/FieldReader.js';

export interface ShortenedLinkProps {
    readonly id: string;
    readonly originalLink: string;
    readonly shortenedLink: string;
    readonly clickCount: number;
    readonly lastClick: string | null;
    readonly createdAt: string;
}

/**
 * A link of a message body shortened by Calisero, with its click statistics.
 */
export class ShortenedLink implements ShortenedLinkProps {
    readonly id: string;

    /**
     * The URL as it was written in the message body.
     */
    readonly originalLink: string;

    /**
     * The short URL that replaced it in the SMS sent.
     */
    readonly shortenedLink: string;

    /**
     * How many times the short URL was opened.
     */
    readonly clickCount: number;

    /**
     * When the short URL was last opened; null if it never was.
     */
    readonly lastClick: string | null;

    readonly createdAt: string;

    constructor(props: ShortenedLinkProps) {
        this.id = props.id;
        this.originalLink = props.originalLink;
        this.shortenedLink = props.shortenedLink;
        this.clickCount = props.clickCount;
        this.lastClick = props.lastClick;
        this.createdAt = props.createdAt;
    }

    /**
     * Read a shortened link as the API sends it.
     *
     * @throws {TypeError} when a required field is missing or malformed
     */
    static fromObject(data: unknown, context = 'shortened link'): ShortenedLink {
        const read = FieldReader.of(data, context);

        return new ShortenedLink({
            id: read.string('id'),
            originalLink: read.string('original_link'),
            shortenedLink: read.string('shortened_link'),
            clickCount: read.optionalInteger('click_count') ?? 0,
            lastClick: read.optionalString('last_click'),
            createdAt: read.string('created_at'),
        });
    }
}
