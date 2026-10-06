# Contributing to Calisero Node.js

Thank you for considering contributing to the Calisero Node.js SMS API library! We welcome contributions from the community.

## Development Setup

You need Node.js 20.19 or later (the version in `.nvmrc` is the one CI checks the code style with).

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/calisero-node.git`
3. Install dependencies: `npm ci`
4. Create a new branch: `git checkout -b feature/your-feature-name`

## Code Standards

This project follows strict coding standards:

- **TypeScript, strict**: `strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` on; no `any`
- **Biome** for formatting and linting: 4 spaces, single quotes, 120 characters a line
- **Full test coverage** for new features: CI fails below the coverage thresholds of `vitest.config.ts`
- **No runtime dependency**: the library uses only Node.js itself
- **The API's OpenAPI document** (`resources/openApi/api-v1.json`) is the reference: field names, types and status codes come from it, and the contract tests check them against it

### Running Quality Assurance

```bash
# Run every check, as CI does
npm run qa

# Or individually:
npm run lint          # Code style and lint rules (Biome)
npm run format        # Fix the code style
npm run typecheck     # TypeScript, sources and tests
npm test              # Tests
npm run test:coverage # Tests with coverage, report in coverage/
npm run build         # Compile to dist/
npm run smoke         # Load the built package with import and require()
npm run examples:check # Check the examples' syntax and their use of the public API
```

## Testing

- Write tests for all new functionality, in `tests/`
- Ensure existing tests continue to pass: CI runs them on Node.js 20, 22, 24 and 26
- Use meaningful test names and assertions
- Cover both success and error scenarios
- Build fixtures from what the API really sends (`tests/support/fixtures.ts`, the OpenAPI examples)

No test may reach the network: services run against a stub transport, the HTTP layer against a local server.
[TESTING.md](TESTING.md) describes the suite.

## Pull Request Process

1. Ensure all QA checks pass (`npm run qa`)
2. Update the README.md if needed
3. Update CHANGELOG.md following [Keep a Changelog](https://keepachangelog.com/) format
4. Create a Pull Request with:
   - Clear title and description
   - Reference to any related issues
   - Examples if applicable

## Releasing

1. Set the new version in `package.json` and in `src/version.ts` (sent in the `User-Agent` header): a test checks
   that both match the latest version of CHANGELOG.md
2. Move the changes from `[Unreleased]` to the new version in CHANGELOG.md
3. Merge, then publish a GitHub release whose tag is the version (`v1.2.3` or `1.2.3`)

The `publish` job of the CI workflow then runs every check again and publishes the package to npm with provenance.
It authenticates with npm's trusted publishing (configure the repository on npmjs.com), or with an `NPM_TOKEN`
repository secret.

## Code Style

Biome formats and lints the code (`biome.json`). Key points:

- Named exports only, one class per file, PascalCase file names for classes
- `readonly` properties on the DTOs, camelCase names mapped from the API's snake_case fields
- Errors that say what is wrong and with which field
- Comments that explain why, not what

## Commit Messages

Use clear, descriptive commit messages:

```
feat: add support for custom HTTP headers
fix: handle null values in message responses
docs: update README with new examples
test: add integration tests for opt-out service
```

## Reporting Issues

When reporting issues, please include:

- Node.js version
- Library version
- Minimal code example reproducing the issue
- Expected vs actual behavior
- Any error messages, with the trace ID (`error.traceId`)

## Security

If you discover a security vulnerability, please send an email to support@calisero.ro instead of using the issue tracker.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
