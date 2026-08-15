/** @type {import('jest').Config} */
module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // TypeScript support
  preset: 'ts-jest',
  
  // Root directories
  roots: ['<rootDir>/src'],
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.spec.ts',
    '**/*.test.ts',
    '**/*.spec.ts'
  ],
  
  // File extensions to consider
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Transform files
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  
  // Module name mapping for absolute imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@test/(.*)$': '<rootDir>/src/test/$1',
    // ESM-only packages that Jest's CJS runtime cannot parse
    '^@modelcontextprotocol/ext-apps/server$': '<rootDir>/src/test/mocks/extAppsServer.js',
    '^@anthropic-ai/claude-agent-sdk$': '<rootDir>/src/test/mocks/claudeAgentSdk.js',
    // Legacy native package no longer installed; suites jest.mock() it
    '^duckdb$': '<rootDir>/src/test/mocks/duckdb.js',
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  
  // Coverage configuration (off by default; run with --coverage to collect)
  collectCoverage: false,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/test/**',
    '!src/**/__tests__/**',
    '!src/**/index.ts',
    '!src/index.ts'
  ],
  // Test timeouts
  testTimeout: 30000,
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
  ],
  
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  
  // Verbose output
  verbose: true,
  
  // Error handling
  bail: false,
  
  // Module directories
  moduleDirectories: ['node_modules', '<rootDir>/src'],
  
  // Global variables for tests
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
      isolatedModules: true,
    },
  },
  
  // Max workers for parallel execution
  maxWorkers: 4,
  
  // Force exit after tests complete
  forceExit: true,
  
  // Detect open handles
  detectOpenHandles: true,
};