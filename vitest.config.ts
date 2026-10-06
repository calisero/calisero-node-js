import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/**/*.test.ts'],
        environment: 'node',
        // Every test runs against stub transports: none may reach the network.
        restoreMocks: true,
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            // Re-exports and interfaces only: no code to run
            exclude: ['src/index.ts', 'src/contracts/**', 'src/http/HttpRequest.ts'],
            reporter: ['text', 'html', 'clover', 'lcov'],
            reportsDirectory: 'coverage',
            thresholds: {
                statements: 98,
                branches: 95,
                functions: 98,
                lines: 98,
            },
        },
    },
});
