import { VERSION } from '../version.js';

/**
 * The product token that opens the User-Agent header of every request: the library
 * and its version. A request whose User-Agent starts with `Calisero-SMS-Node/`
 * comes from this library.
 */
export const USER_AGENT = `Calisero-SMS-Node/${VERSION}`;

/**
 * Your application, named in the User-Agent header after the library.
 */
export interface AppInfo {
    /**
     * Your application's name, e.g. `MyShop`.
     */
    readonly name: string;

    /**
     * Your application's version, e.g. `2.1.0`.
     */
    readonly version?: string | undefined;
}

/**
 * What the User-Agent header says of the runtime.
 *
 * @internal
 */
export interface RuntimeInfo {
    readonly versions?: Readonly<Record<string, string | undefined>> | undefined;
    readonly platform?: string | undefined;
    readonly arch?: string | undefined;
}

/**
 * The User-Agent header: the library and its version, the runtime and, when given,
 * your application, e.g.
 * `Calisero-SMS-Node/1.0.0 (Node.js v24.21.0; linux x64) MyShop/2.1.0`.
 *
 * @param runtime the runtime to describe: this process by default, null for none
 * @throws {TypeError} when the application has no usable name
 */
export function buildUserAgent(
    appInfo?: AppInfo | null,
    runtime: RuntimeInfo | null | undefined = globalThis.process,
): string {
    const parts = [USER_AGENT];
    const comment = runtimeComment(runtime);

    if (comment !== null) {
        parts.push(comment);
    }

    if (appInfo !== undefined && appInfo !== null) {
        parts.push(appProduct(appInfo));
    }

    return parts.join(' ');
}

/**
 * The runtime, its version, the operating system and the processor, e.g.
 * `(Node.js v24.21.0; linux x64)`; null outside a runtime that describes itself
 * (a browser or an edge worker has no `process`).
 */
function runtimeComment(runtime: RuntimeInfo | null | undefined): string | null {
    const versions = runtime?.versions;
    let name: string | null = null;

    // Bun and Deno report a Node.js version too, for compatibility: name them first
    if (versions?.bun !== undefined) {
        name = `Bun v${versions.bun}`;
    } else if (versions?.deno !== undefined) {
        name = `Deno v${versions.deno}`;
    } else if (versions?.node !== undefined) {
        name = `Node.js v${versions.node}`;
    }

    if (name === null) {
        return null;
    }

    const system = [runtime?.platform, runtime?.arch].filter((part) => part !== undefined && part !== '').join(' ');

    return system === '' ? `(${name})` : `(${name}; ${system})`;
}

/**
 * The application as a product token: `name/version`, both reduced to the
 * characters a header token allows, so the header stays a single valid line.
 */
function appProduct(appInfo: AppInfo): string {
    const name = typeof appInfo.name === 'string' ? toToken(appInfo.name) : '';
    const version = typeof appInfo.version === 'string' ? toToken(appInfo.version) : '';

    if (name === '') {
        throw new TypeError('appInfo.name must name your application with letters, digits or -._ characters.');
    }

    return version === '' ? name : `${name}/${version}`;
}

function toToken(value: string): string {
    return value.replace(/[^A-Za-z0-9!#$%&'*+.^_`|~-]+/g, '-').replace(/^-+|-+$/g, '');
}
