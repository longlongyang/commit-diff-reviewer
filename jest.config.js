/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/__tests__/**/*.test.ts'],
    moduleFileExtensions: ['ts', 'js'],
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/extension.ts',
        '!src/commands/**',
        '!src/providers/**'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov'],
    moduleNameMapper: {
        '^vscode$': '<rootDir>/src/__tests__/__mocks__/vscode.ts'
    },
    transform: {
        '^.+\\.ts$': ['ts-jest', {
            tsconfig: {
                module: 'commonjs',
                target: 'ES2020',
                lib: ['ES2020'],
                strict: true,
                esModuleInterop: true,
                skipLibCheck: true,
                forceConsistentCasingInFileNames: true,
                resolveJsonModule: true
            }
        }]
    },
    testPathIgnorePatterns: [
        '/node_modules/',
        '/__mocks__/'
    ]
};
