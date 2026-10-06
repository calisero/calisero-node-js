import { describe, expect, it } from 'vitest';
import { buildUserAgent, USER_AGENT } from '../../../src/http/userAgent.js';
import { VERSION } from '../../../src/index.js';

const node = { versions: { node: '24.21.0' }, platform: 'linux', arch: 'x64' };

describe('buildUserAgent()', () => {
    it('opens with the library and its version', () => {
        expect(USER_AGENT).toBe(`Calisero-SMS-Node/${VERSION}`);
        expect(buildUserAgent()).toMatch(new RegExp(`^Calisero-SMS-Node/${VERSION.replaceAll('.', '\\.')} `));
    });

    it('names the Node.js version, the operating system and the processor of this process', () => {
        expect(buildUserAgent()).toBe(
            `Calisero-SMS-Node/${VERSION} (Node.js ${process.version}; ${process.platform} ${process.arch})`,
        );
    });

    it('names the runtime it is given', () => {
        expect(buildUserAgent(null, node)).toBe(`Calisero-SMS-Node/${VERSION} (Node.js v24.21.0; linux x64)`);
        expect(
            buildUserAgent(null, { versions: { node: '24.3.0', bun: '1.3.1' }, platform: 'darwin', arch: 'arm64' }),
        ).toBe(`Calisero-SMS-Node/${VERSION} (Bun v1.3.1; darwin arm64)`);
        expect(
            buildUserAgent(null, { versions: { node: '24.2.0', deno: '2.5.4' }, platform: 'win32', arch: 'x64' }),
        ).toBe(`Calisero-SMS-Node/${VERSION} (Deno v2.5.4; win32 x64)`);
        expect(buildUserAgent(null, { versions: { node: '22.12.0' } })).toBe(
            `Calisero-SMS-Node/${VERSION} (Node.js v22.12.0)`,
        );
    });

    it('names only the library outside a runtime that describes itself', () => {
        expect(buildUserAgent(null, null)).toBe(USER_AGENT);
        expect(buildUserAgent(null, {})).toBe(USER_AGENT);
        expect(buildUserAgent(null, { versions: {} })).toBe(USER_AGENT);
    });

    it('names your application after the library', () => {
        expect(buildUserAgent({ name: 'MyShop', version: '2.1.0' }, node)).toBe(
            `Calisero-SMS-Node/${VERSION} (Node.js v24.21.0; linux x64) MyShop/2.1.0`,
        );
        expect(buildUserAgent({ name: 'MyShop' }, node)).toBe(
            `Calisero-SMS-Node/${VERSION} (Node.js v24.21.0; linux x64) MyShop`,
        );
        expect(buildUserAgent({ name: 'MyShop', version: '' }, node)).toBe(
            `Calisero-SMS-Node/${VERSION} (Node.js v24.21.0; linux x64) MyShop`,
        );
    });

    it('keeps the header a single valid line, whatever the application name', () => {
        expect(buildUserAgent({ name: 'My Shop\r\nX-Injected: yes', version: '2.1 (beta)' }, node)).toBe(
            `Calisero-SMS-Node/${VERSION} (Node.js v24.21.0; linux x64) My-Shop-X-Injected-yes/2.1-beta`,
        );
        expect(buildUserAgent({ name: 'Magazinul Ștefan', version: '1.0' }, node)).toBe(
            `Calisero-SMS-Node/${VERSION} (Node.js v24.21.0; linux x64) Magazinul-tefan/1.0`,
        );
    });

    it.each([
        ['an empty name', { name: '' }],
        ['a blank name', { name: '   ' }],
        ['a name without a usable character', { name: '()' }],
        ['a name that is not a string', { name: 42 as unknown as string }],
    ])('refuses %s', (_, appInfo) => {
        expect(() => buildUserAgent(appInfo, node)).toThrow(
            new TypeError('appInfo.name must name your application with letters, digits or -._ characters.'),
        );
    });
});
