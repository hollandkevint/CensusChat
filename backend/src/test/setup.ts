import { jest } from '@jest/globals';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long-for-testing';
process.env.POSTGRES_HOST = 'localhost';
process.env.POSTGRES_PORT = '5432';
process.env.POSTGRES_DB = 'censuschat_test';
process.env.POSTGRES_USER = 'test_user';
process.env.POSTGRES_PASSWORD = 'test_password';
process.env.POSTGRES_SSL = 'false';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.DUCKDB_PATH = ':memory:';
process.env.DUCKDB_MEMORY = 'true';
process.env.CENSUS_API_URL = 'https://api.census.gov';
// Force the Census service into hermetic mock mode for tests. Set before the
// app/dotenv loads so dotenv.config() (which does not override existing vars)
// cannot leak a real key from .env into the test process.
process.env.CENSUS_API_KEY = '';
process.env.USE_LIVE_CENSUS_API = 'false';
process.env.PORT = '3001';
// Give each Jest worker its own port so app-importing suites don't collide,
// and point the in-process MCP HTTP client at the right server
const testPort = 3100 + parseInt(process.env.JEST_WORKER_ID || '1', 10);
process.env.PORT = String(testPort);
process.env.MCP_SERVER_URL = `http://localhost:${testPort}`;
process.env.QUERY_TIMEOUT_MS = '2000';
process.env.DISABLE_RATE_LIMITING = 'true';
process.env.CORS_ORIGIN = 'http://localhost:3000';

// Global test timeout
jest.setTimeout(30000);

// Console suppression for cleaner test output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Suppress console output during tests unless explicitly needed
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  // Restore console output
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Mock external dependencies
beforeEach(() => {
  jest.clearAllMocks();
});

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export {};