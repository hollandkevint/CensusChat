# Census Data Loading System - Testing Guide

## Overview

This guide covers the comprehensive testing suite for the Census Data Loading System, including unit tests, integration tests, and performance validation.

## Test Structure

### Test Framework
- **Jest**: Primary testing framework with TypeScript support
- **Supertest**: HTTP assertion library for API endpoint testing
- **Custom Mocks**: Specialized mocks for Census API and DuckDB

### Test Categories

#### 1. Unit Tests (`src/__tests__/*.test.ts`)
- **PriorityQueueManager**: Job queuing, prioritization, and retry logic
- **DataLoadingOrchestrator**: Master coordination and workflow management
- **ConcurrentWorkerPool**: Parallel processing and worker allocation
- **DataValidationService**: Data quality validation and scoring
- **Configuration Management**: Settings validation and adaptation

#### 2. Integration Tests (`src/__tests__/integration/`)
- **censusApiService**: API integration with mock and real responses
- **dataLoading.e2e**: End-to-end workflow testing

#### 3. Route Tests (`src/__tests__/routes/`)
- **dataLoading**: REST API endpoint validation

## Running Tests

### Install Dependencies
```bash
cd backend
npm install
```

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites
```bash
# Unit tests only
npm test -- --testPathPattern="__tests__/[^/]+\.test\.ts$"

# Integration tests only
npm test -- --testPathPattern="integration"

# Route tests only
npm test -- --testPathPattern="routes"

# Specific test file
npm test PriorityQueueManager.test.ts
```

### Run Tests with Coverage
```bash
npm test -- --coverage
```

### Watch Mode (Development)
```bash
npm test -- --watch
```

## Test Configuration

### Jest Configuration (`jest.config.js`)
```javascript
{
  testEnvironment: 'node',
  preset: 'ts-jest',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  testTimeout: 30000
}
```

### Environment Variables for Testing
Tests use mocked environment variables defined in `src/test/setup.ts`:
```typescript
process.env.NODE_ENV = 'test';
process.env.DUCKDB_PATH = ':memory:';
process.env.DUCKDB_MEMORY = 'true';
// ... other test variables
```

## Test Fixtures and Mocks

### Mock Census API Responses
Located in `src/test/fixtures/censusApiResponses.ts`:

- **mockStateResponse**: Sample state-level data
- **mockZipCodeResponse**: Sample ZIP code data
- **mockBlockGroupResponse**: Sample block group data
- **mockDataScenarios**: Various data quality scenarios

### Mock Services
- **MockCensusApiService**: Controllable API responses for testing
- **MockDuckDBConnection**: Database operation mocking
- **MockEventEmitter**: Event system testing

### Test Utilities
Located in `src/test/helpers/testUtils.ts`:

- **createTestJob()**: Generate test loading jobs
- **createTestConfig()**: Generate test configurations
- **TestAssertions**: Validation helpers
- **CallTracker**: Track function calls
- **TestDataGenerator**: Generate test datasets

## Test Scenarios

### Unit Test Coverage

#### PriorityQueueManager
- ✅ Job addition and retrieval
- ✅ Priority-based ordering
- ✅ Phase-based organization
- ✅ Retry logic and failure handling
- ✅ Queue metrics and analytics
- ✅ Memory management and cleanup

#### DataLoadingOrchestrator
- ✅ Initialization and configuration
- ✅ Priority loading workflow
- ✅ Job management and custom jobs
- ✅ Control operations (pause/resume/stop)
- ✅ Progress tracking and metrics
- ✅ Event handling and error recovery

#### ConcurrentWorkerPool
- ✅ Worker initialization and management
- ✅ Job processing for different geographies
- ✅ Error handling and retry mechanisms
- ✅ Rate limiting and API management
- ✅ Performance metrics and monitoring

#### DataValidationService
- ✅ Record validation and quality scoring
- ✅ Geography-specific validation rules
- ✅ Data range and outlier detection
- ✅ Issue aggregation and reporting
- ✅ Configuration impact on validation

### Integration Test Coverage

#### Census API Service
- ✅ Service initialization and configuration
- ✅ Query building and execution
- ✅ Error handling (network, rate limits, invalid data)
- ✅ Variable validation
- ✅ Knowledge base integration

#### End-to-End Workflow
- ✅ Complete loading workflow execution
- ✅ Custom job processing
- ✅ System health during concurrent operations
- ✅ Error recovery scenarios
- ✅ Performance under load
- ✅ Data quality validation
- ✅ Resource management

### Route Test Coverage

#### API Endpoints
- ✅ `POST /start` - Start loading with phases
- ✅ `GET /progress` - Progress monitoring
- ✅ `GET /metrics` - System metrics
- ✅ `POST /pause|resume|stop` - Control operations
- ✅ `POST /jobs` - Custom job creation
- ✅ `GET /phases` - Available phases
- ✅ `GET /priorities` - Priority configuration
- ✅ `GET /config` - Configuration management
- ✅ `PATCH /config` - Configuration updates
- ✅ `GET /analytics` - Performance analytics
- ✅ `GET /health` - Health monitoring

## Performance Testing

### Load Testing
Tests validate system performance under various conditions:

```typescript
// Example: Moderate load test
const jobCount = 10;
const jobs = Array.from({ length: jobCount }, () => 
  orchestrator.addJob(geography, variables, priority)
);

const startTime = Date.now();
await orchestrator.startPriorityLoading();
const duration = Date.now() - startTime;

expect(duration).toBeLessThan(5000); // 5 second threshold
```

### Memory Testing
Validates efficient memory usage:

```typescript
const initialMemory = process.memoryUsage();
// ... process large dataset
const finalMemory = process.memoryUsage();
const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;

expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024); // <100MB
```

### Rate Limit Testing
Ensures API limits are respected:

```typescript
const strictConfig = createTestConfig({
  apiRateLimit: { dailyLimit: 20, burstLimit: 3 }
});

// Submit many jobs and verify rate limiting
const context = orchestrator.getContext();
expect(context.rateLimit.remainingCalls).toBeLessThan(20);
```

## Error Scenarios Tested

### API Failures
- Network connectivity issues
- Rate limit exceeded (429 errors)
- Invalid requests (400 errors)
- Authentication failures
- Empty responses

### System Failures
- Database connection issues
- Memory constraints
- Configuration errors
- Timeout scenarios

### Data Quality Issues
- Missing required fields
- Invalid data formats
- Geography code validation
- Numeric range violations
- Outlier detection

## Real API Testing (Limited)

### Environment Variables
For limited real API testing (requires API budget):

```bash
export TEST_REAL_API=true
export CENSUS_API_KEY=your_api_key_here
```

### Real API Test Scenarios
- Single state data retrieval (minimal API usage)
- Response format validation
- Rate limit behavior verification

⚠️ **Warning**: Real API tests consume API quota and are disabled by default in CI/CD.

## Coverage Reports

### Generated Reports
```bash
npm test -- --coverage
```

Creates coverage reports in:
- `coverage/lcov-report/index.html` - Interactive HTML report
- `coverage/lcov.info` - LCOV format for CI integration
- `coverage/clover.xml` - Clover format

### Coverage Targets
- **Branches**: 80%
- **Functions**: 85%
- **Lines**: 85%
- **Statements**: 85%

### Current Coverage (Example)
```
File                                 | % Stmts | % Branch | % Funcs | % Lines |
-------------------------------------|---------|----------|---------|---------|
PriorityQueueManager.ts             |   95.2  |   91.7   |   100   |   94.8  |
DataLoadingOrchestrator.ts          |   89.1  |   83.3   |   95.0  |   88.7  |
ConcurrentWorkerPool.ts             |   92.3  |   87.5   |   97.1  |   91.9  |
DataValidationService.ts            |   96.7  |   94.4   |   100   |   96.2  |
-------------------------------------|---------|----------|---------|---------|
All files                           |   93.1  |   89.2   |   98.0  |   92.9  |
```

## Test Best Practices

### 1. Isolation
- Each test is independent
- Mocks are reset between tests
- No shared state between tests

### 2. Descriptive Names
```typescript
test('should prioritize older jobs when priorities are equal', async () => {
  // Test implementation
});
```

### 3. Comprehensive Scenarios
- Happy path testing
- Error condition testing
- Edge case validation
- Performance verification

### 4. Mock Management
```typescript
beforeEach(() => {
  mockCensusApiService.setFailure(false);
  mockCensusApiService.setDelay(0);
  jest.clearAllMocks();
});
```

### 5. Async Testing
```typescript
test('should handle async operations', async () => {
  const promise = orchestrator.startPriorityLoading();
  await wait(100); // Allow processing
  await orchestrator.stopLoading();
  await promise.catch(() => {}); // Handle expected stop
});
```

## Troubleshooting Tests

### Common Issues

#### Test Timeouts
```typescript
// Increase timeout for long-running tests
jest.setTimeout(60000);

// Or per test
test('long running test', async () => {
  // test implementation
}, 60000);
```

#### Memory Leaks
```typescript
afterEach(async () => {
  await orchestrator.stopLoading();
  orchestrator.removeAllListeners();
});
```

#### Mock Issues
```typescript
// Verify mock setup
expect(mockService.method).toHaveBeenCalledWith(expectedArgs);

// Debug mock state
console.log(mockService.method.mock.calls);
```

### Debugging Tests
```bash
# Run single test with debugging
node --inspect-brk node_modules/.bin/jest --runInBand TestName.test.ts

# Run with verbose output
npm test -- --verbose

# Run specific test pattern
npm test -- --testNamePattern="should handle API errors"
```

## Continuous Integration

### GitHub Actions Integration
```yaml
- name: Run Tests
  run: |
    npm test -- --coverage --ci
    
- name: Upload Coverage
  uses: codecov/codecov-action@v1
  with:
    file: ./coverage/lcov.info
```

### Test Reports
- Coverage reports uploaded to Codecov
- Test results in JUnit format for CI integration
- Performance metrics tracking over time

## Next Steps

### Expanding Test Coverage
1. **Database Integration Tests**: Real DuckDB testing
2. **Stress Testing**: Higher load scenarios
3. **Network Resilience**: Intermittent connectivity testing
4. **Configuration Edge Cases**: Invalid configurations

### Performance Benchmarking
1. **Baseline Metrics**: Establish performance baselines
2. **Regression Testing**: Detect performance degradation
3. **Load Testing**: Automated high-load scenarios

### Quality Metrics
1. **Mutation Testing**: Verify test effectiveness
2. **Property-Based Testing**: Automated test case generation
3. **Contract Testing**: API contract validation

---

This comprehensive testing suite ensures the Census Data Loading System is robust, reliable, and ready for production use.