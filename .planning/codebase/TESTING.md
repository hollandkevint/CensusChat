# Testing Patterns

**Analysis Date:** 2026-02-01

## Test Framework

**Runner:**
- Jest 30.0.5 (backend) and 30.1.3 (frontend)
- Config: `backend/jest.config.js`
- Preset: `ts-jest` for TypeScript support
- Environment: `node` for backend, `jsdom` for frontend

**Assertion Library:**
- Jest built-in matchers (expect, toBe, toEqual, etc.)
- Supertest for HTTP assertions (backend route testing)
- React Testing Library for component testing (frontend)

**Run Commands:**
```bash
# Backend (from backend/)
npm run test              # Run all tests
npm run test -- --watch   # Watch mode
npm run test -- --coverage

# Frontend (from frontend/)
npm run test              # Run all tests with Jest

# Code quality
npm run lint              # ESLint
npm run typecheck         # TypeScript check
```

## Test File Organization

**Location:**
- Backend: Co-located in `__tests__` directories alongside source code
- Pattern: `backend/src/__tests__/` mirrors `backend/src/` structure
- Frontend: Co-located with components (e.g., `src/components/__tests__/`)

**Naming:**
- Backend: `.test.ts` or `.spec.ts` suffix (both patterns used)
- Jest config: matches both patterns via `testMatch` glob

**Structure:**
```
backend/src/
├── __tests__/
│   ├── routes/
│   │   ├── query.routes.test.ts
│   │   ├── export.routes.test.ts
│   │   └── dataLoading.test.ts
│   ├── services/
│   │   ├── excelExportService.test.ts
│   │   ├── mcpServerService.test.ts
│   │   └── dataRefreshService.test.ts
│   ├── utils/
│   │   ├── duckdbPool.test.ts
│   │   ├── circuitBreaker.test.ts
│   │   └── mcpTools.test.ts
│   ├── integration/
│   │   ├── censusApiService.test.ts
│   │   ├── censusApiIntegration.test.ts
│   │   └── dataLoading.e2e.test.ts
│   └── [Unit tests for orchestrators]
├── test/
│   ├── setup.ts
│   ├── fixtures/
│   │   └── censusApiResponses.ts
│   └── helpers/
│       └── testUtils.ts
└── [Source files]
```

## Test Structure

**Suite Organization:**
```typescript
describe('DuckDBPool', () => {
  let pool: DuckDBPool;

  beforeEach(() => {
    // Reset singleton
    (global as any).poolInstance = null;
    pool = new DuckDBPool({
      minConnections: 1,
      maxConnections: 3,
      connectionTimeout: 1000,
      memoryLimit: '1GB',
      threads: 2,
    });
  });

  afterEach(async () => {
    if (pool) {
      await pool.close();
    }
    await closeDuckDBPool();
  });

  describe('initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(pool).toBeInstanceOf(DuckDBPool);
      const stats = pool.getStats();
      expect(stats.totalConnections).toBe(0);
    });
  });
});
```

**Patterns:**
- Setup: `beforeEach()` for test isolation (reset singletons, create fresh instances)
- Teardown: `afterEach()` for cleanup (close connections, reset mocks)
- Grouped assertions: `describe()` blocks organize related tests by feature
- Nested describe: Hierarchical organization (e.g., `initialization`, `connection management`)

## Mocking

**Framework:** Jest built-in mocking (`jest.mock()`, `jest.fn()`)

**Patterns:**
```typescript
// Module-level mocking (top of test file)
jest.mock('duckdb', () => ({
  Database: jest.fn().mockImplementation(() => ({
    run: jest.fn((sql, callback) => {
      setTimeout(() => callback(null), 10);
    }),
    all: jest.fn((sql, callback) => {
      setTimeout(() => callback(null, mockData), 10);
    }),
    close: jest.fn((callback) => {
      setTimeout(() => callback(null), 10);
    }),
  })),
}));

// Service mocking (specific services)
jest.mock('../../services/anthropicService', () => ({
  anthropicService: {
    analyzeQuery: jest.fn()
  }
}));

// Type casting for mock assertions
const mockAnthropicService = anthropicService as jest.Mocked<typeof anthropicService>;

// Clearing mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Setup mock return values
mockAnthropicService.analyzeQuery.mockResolvedValue({
  analysis: mockAnalysis,
  sqlQuery: 'SELECT * FROM census_data',
  explanation: 'Query explanation',
  suggestedRefinements: []
});

// Assert mock was called
expect(mockAnthropicService.analyzeQuery).toHaveBeenCalledWith(
  'Show me Medicare eligible seniors'
);
```

**What to Mock:**
- External services (DuckDB, Redis, Anthropic API)
- Database connections
- File system operations
- Network calls (via Supertest for routes)
- Time-dependent operations (setTimeout/intervals)

**What NOT to Mock:**
- Pure utility functions
- Type definitions
- Local services called in integration tests
- React hooks in component tests (use `useCallback`, `useState` directly)

## Fixtures and Factories

**Test Data:**
```typescript
// From excelExportService.test.ts
const createMockQueryResult = (rowCount: number = 10): QueryResultForExport => ({
  success: true,
  message: 'Test query successful',
  data: Array.from({ length: rowCount }, (_, i) => ({
    id: i + 1,
    name: `Test Record ${i + 1}`,
    value: Math.floor(Math.random() * 1000),
    category: i % 2 === 0 ? 'Category A' : 'Category B',
    date: new Date().toISOString().split('T')[0]
  })),
  metadata: {
    queryTime: 1.5,
    totalRecords: rowCount,
    dataSource: 'US Census Bureau',
    confidenceLevel: 0.95,
    marginOfError: 2.3,
    queryText: 'Test query for demographics',
    executedAt: new Date().toISOString(),
    geographyLevel: 'State',
    variables: ['population', 'income', 'age']
  }
});

// Factory for request objects
const createMockExportRequest = (options: Partial<ExportRequest['options']> = {}): ExportRequest => ({
  queryId: 'test-query-123',
  format: 'excel',
  options: {
    includeMetadata: true,
    compression: false,
    maxRows: 50000,
    ...options
  }
});
```

**Location:**
- Fixtures: `backend/src/test/fixtures/censusApiResponses.ts` (reusable test data)
- Inline factories: Within test file as `createMock*` functions for one-off usage
- Helpers: `backend/src/test/helpers/testUtils.ts` for common test utilities

## Coverage

**Requirements:** Target 80%+ coverage
- Branches: 80%
- Functions: 85%
- Lines: 85%
- Statements: 85%

**View Coverage:**
```bash
npm run test -- --coverage
# Output: coverage/index.html
```

**Excluded from Coverage:**
- `src/**/*.d.ts` (type definitions)
- `src/test/**` (test utilities)
- `src/**/__tests__/**` (test files)
- `src/**/index.ts` (barrel files)

## Test Types

**Unit Tests:**
- Scope: Individual functions, classes, and utilities
- Approach: Isolated via mocking external dependencies
- Location: Same directory as source
- Example: `backend/src/__tests__/utils/circuitBreaker.test.ts`
- Coverage: ~60% of tests in codebase

**Integration Tests:**
- Scope: Multiple components working together
- Approach: Real database connections, mocked external APIs
- Location: `backend/src/__tests__/integration/`
- Example: `backend/src/__tests__/integration/censusApiService.test.ts`
- Coverage: ~20% of tests in codebase
- Tests: Service interactions, route handlers, data loading workflows

**E2E Tests:**
- Scope: Full workflows (data loading, export, queries)
- Approach: Real stack simulation with mocked external services
- Location: `backend/src/__tests__/integration/dataLoading.e2e.test.ts`
- Coverage: ~15% of tests; slower (longer timeouts)

**Route Tests:**
- Scope: HTTP endpoints
- Approach: Supertest for request/response testing
- Location: `backend/src/__tests__/routes/`
- Pattern: Mocked services, real Express app instance
- Example assertions: `expect(response.status).toBe(200)`, `expect(response.body.data).toBeDefined()`

## Common Patterns

**Async Testing:**
```typescript
// Promise-based
it('should successfully process a valid query', async () => {
  mockAnthropicService.analyzeQuery.mockResolvedValue(mockAnalysis);

  const response = await request(app)
    .post('/api/v1/queries')
    .send({ query: 'Show me Medicare eligible seniors' });

  expect(response.status).toBe(200);
});

// Callback-based (DuckDB)
jest.mock('duckdb', () => ({
  Database: jest.fn().mockImplementation(() => ({
    all: jest.fn((sql, callback) => {
      setTimeout(() => callback(null, mockData), 10);
    })
  }))
}));
```

**Error Testing:**
```typescript
it('should return 400 for missing query', async () => {
  const response = await request(app)
    .post('/api/v1/queries')
    .send({});

  expect(response.status).toBe(400);
  expect(response.body.error).toBeDefined();
});

// Circuit breaker state transitions
it('should open circuit after threshold failures', async () => {
  for (let i = 0; i < 5; i++) {
    try {
      await circuitBreaker.execute(() => Promise.reject('Error'));
    } catch (error) {
      // Expected failures
    }
  }

  expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
});
```

**File System Testing:**
```typescript
// excelExportService.test.ts pattern
const testTempDir = path.join(process.cwd(), 'temp', 'test-exports');

beforeEach(() => {
  if (!fs.existsSync(testTempDir)) {
    fs.mkdirSync(testTempDir, { recursive: true });
  }
});

afterEach(() => {
  // Clean up test files
  if (fs.existsSync(testTempDir)) {
    const files = fs.readdirSync(testTempDir);
    files.forEach(file => {
      fs.unlinkSync(path.join(testTempDir, file));
    });
  }
});

afterAll(() => {
  // Remove test directory
  if (fs.existsSync(testTempDir)) {
    fs.rmSync(testTempDir, { recursive: true, force: true });
  }
});
```

## Test Setup and Configuration

**Global Setup:** `backend/src/test/setup.ts`
```typescript
// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long-for-testing';
process.env.DUCKDB_PATH = ':memory:'; // Use in-memory DB for tests
process.env.DUCKDB_MEMORY = 'true';

// Global test timeout
jest.setTimeout(30000);

// Suppress console during tests
beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});
```

**Jest Config Settings:**
- `testEnvironment: 'node'` for backend, `jsdom` for frontend
- `clearMocks: true` - reset mocks between tests
- `restoreMocks: true` - restore original implementations
- `detectOpenHandles: true` - find resource leaks
- `forceExit: true` - exit after tests complete
- `maxWorkers: 4` - parallel execution
- `testTimeout: 30000` - 30 second timeout per test

## Running Tests

**Common Commands:**
```bash
# Run all tests with coverage
npm run test -- --coverage

# Run specific test file
npm run test -- duckdbPool.test.ts

# Run tests matching pattern
npm run test -- --testNamePattern="initialization"

# Run with verbose output
npm run test -- --verbose

# Watch mode for development
npm run test -- --watch
```

## Debugging Tests

**Techniques:**
- Add `.only` to run single test: `it.only('should...', () => {})`
- Add `.skip` to skip test: `it.skip('should...', () => {})`
- Use console logs (mocked during normal test runs but visible with --verbose)
- Inspect mock calls: `console.log(mockFn.mock.calls)` after mock is called

**Common Issues:**
- Timeout errors: Increase `testTimeout` in config or individual test
- Mock not working: Ensure `jest.mock()` is at file top, before imports
- Singleton state bleeding: Reset globals in `beforeEach()` (as done in `duckdbPool.test.ts`)
- Async callback errors: Use `await` on async operations, proper error handling in callbacks

---

*Testing analysis: 2026-02-01*
