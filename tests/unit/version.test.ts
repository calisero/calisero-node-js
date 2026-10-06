import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SmsClient, USER_AGENT, VERSION } from '../../src/index.js';

const read = (file: string): string => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

describe('VERSION', () => {
    it('is the version of package.json', () => {
        const { version } = JSON.parse(read('package.json')) as { version: string };

        expect(VERSION).toBe(version);
    });

    it('is the latest version of CHANGELOG.md', () => {
        const latest = /^## \[(\d+\.\d+\.\d+)\]/m.exec(read('CHANGELOG.md'))?.[1];

        expect(latest, 'Set VERSION in src/version.ts to the version being released').toBe(VERSION);
    });

    it('is a semantic version', () => {
        expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('is exposed as SmsClient.VERSION and named in the User-Agent', () => {
        expect(SmsClient.VERSION).toBe(VERSION);
        expect(USER_AGENT).toBe(`Calisero-SMS-Node/${VERSION}`);
    });
});
