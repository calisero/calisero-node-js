/**
 * Checks every example: its syntax (`node --check`), then its use of the public
 * API against the built type declarations (`tsc -p tsconfig.examples.json`).
 * Run after `npm run build`.
 */

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const examples = readdirSync(join(root, 'examples'), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.mjs'))
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();

let failures = 0;

for (const example of examples) {
    const check = spawnSync(process.execPath, ['--check', example], { encoding: 'utf8' });

    if (check.status !== 0) {
        failures++;
        console.error(`❌ ${relative(root, example)}\n${check.stderr}`);
    }
}

if (failures > 0) {
    console.error(`${failures} example(s) failed the syntax check`);
    process.exit(1);
}

console.log(`✅ ${examples.length} examples parse`);

const tsc = spawnSync(
    process.execPath,
    [join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.examples.json'],
    {
        cwd: root,
        encoding: 'utf8',
    },
);

if (tsc.status !== 0) {
    console.error(`❌ The examples do not type-check against the built package:\n${tsc.stdout}${tsc.stderr}`);
    process.exit(1);
}

console.log(`✅ ${examples.length} examples type-check against the public API`);
