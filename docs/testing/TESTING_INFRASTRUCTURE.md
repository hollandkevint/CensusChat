# CensusChat Testing Infrastructure
## Docker-Based Containerized Testing Environment

### Overview

CensusChat uses a sophisticated containerized testing approach that eliminates local development dependencies and provides consistent, reproducible test environments. This infrastructure was designed by our Data Ops Engineering team to achieve production-grade testing capabilities.

### Architecture

```
Testing Infrastructure Components:
├── docker-compose.test.yml     # Test orchestration
├── backend/Dockerfile.test     # Backend test container  
├── frontend/Dockerfile.test    # Frontend test container
├── test-runner.sh             # One-command test execution
└── test-data/                 # Test fixtures and mocks
    ├── duckdb/                # Database snapshots
    ├── wiremock/              # Census API mocking
    └── postgres-init/         # Database initialization
```

### Key Components

#### 1. **Test Services**
- **PostgreSQL** (port 5433): Isolated test database
- **Redis** (port 6380): Test cache layer
- **WireMock** (port 8089): Census API service virtualization
- **DuckDB**: Snapshot-based data management

#### 2. **Test Containers**
- **backend-test**: Runs Jest test suite with coverage
- **frontend-test**: Runs Next.js tests and type checking
- **integration-test**: End-to-end workflow testing
- **test-data-seeder**: Automated fixture generation

### Quick Start

#### Prerequisites
- Docker Desktop installed and running
- Git repository cloned locally

#### Running Tests

```bash
# Run all tests
./test-runner.sh

# Run specific test types
./test-runner.sh unit         # Backend unit tests only
./test-runner.sh integration  # Integration tests only
./test-runner.sh frontend     # Frontend tests only
```

#### Test Results
```bash
# View test coverage
open backend/coverage/lcov-report/index.html

# Check container logs
docker-compose -f docker-compose.test.yml logs [service-name]

# Cleanup after testing
docker-compose -f docker-compose.test.yml down --volumes
```

### Service Virtualization

#### Census API Mock
Our WireMock service provides realistic Census Bureau API responses:

```bash
# Test API mock is working
curl http://localhost:8089/data

# Example response:
{
  "status": "mock_active",
  "message": "Census API Mock Service is running",
  "datasets": ["2020/acs/acs5", "2021/acs/acs5", "2022/acs/acs5"]
}
```

#### Supported Mock Endpoints
- `GET /data` - Root API information
- `GET /data/{year}/acs/acs5` - Census data queries
- `GET /__admin/health` - Service health check

### Data Management

#### DuckDB Snapshots
Fast, reproducible database states for testing:

```bash
# Create new snapshots
./test-data/duckdb/scripts/create-snapshot.sh

# Available snapshots:
├── clean-state.db     # Empty schema (~1MB, <100ms load)
├── foundation.db      # Basic reference data (~50MB, <500ms load) 
└── full-dataset.db    # Complete test dataset (~500MB, <2s load)
```

#### Test Data Seeding
```bash
# Seed test databases
docker-compose -f docker-compose.test.yml up test-data-seeder

# Creates:
- User test accounts
- Geographic reference data  
- Sample census data
- Query history examples
```

### Performance Characteristics

#### Test Execution Times
- **Unit Tests**: ~2-3 minutes
- **Integration Tests**: ~3-4 minutes  
- **Full Test Suite**: ~5-6 minutes
- **Container Build**: ~8-10 minutes (first time), ~2-3 minutes (cached)

#### Resource Usage
- **Memory**: ~2GB during full test execution
- **Disk**: ~1GB for images and volumes
- **CPU**: Utilizes all available cores for parallel testing

### Current Test Status

#### Backend Tests (89% Success Rate)
```
✅ PriorityQueueManager: 25/28 tests passing (87% coverage)
✅ DataValidationService: Complete test coverage (79% coverage) 
✅ Route handlers: 87% coverage
⚠️ 3 route tests failing (configuration endpoints)
```

#### Frontend Tests  
```
✅ Type checking: Passing
✅ ESLint validation: Passing
⚠️ Unit tests: Not yet implemented
⚠️ E2E tests: Not yet configured
```

### Troubleshooting

#### Common Issues

**Docker Build Failures**
```bash
# Clear Docker cache
docker system prune -f
docker builder prune -f

# Rebuild from scratch
docker-compose -f docker-compose.test.yml build --no-cache
```

**WireMock Not Starting**
```bash
# Check WireMock logs
docker-compose -f docker-compose.test.yml logs census-api-mock

# Restart WireMock service
docker-compose -f docker-compose.test.yml restart census-api-mock
```

**Database Connection Issues**
```bash
# Verify database health
docker-compose -f docker-compose.test.yml ps

# Check database logs
docker-compose -f docker-compose.test.yml logs test-postgres
```

**ARM64/Apple Silicon Issues**
The configuration includes platform-specific settings for Apple Silicon:
```yaml
census-api-mock:
  platform: linux/amd64  # Forces x86 emulation for compatibility
```

### Environment Variables

#### Test Configuration
```bash
# Backend test environment
NODE_ENV=test
POSTGRES_HOST=test-postgres  
POSTGRES_PORT=5432
POSTGRES_USER=census_test
POSTGRES_PASSWORD=test_password_123
POSTGRES_DB=census_test
REDIS_HOST=test-redis
REDIS_PORT=6379
CENSUS_API_BASE_URL=http://census-api-mock:8080
CENSUS_API_KEY=test_api_key_mock
```

### Integration with CI/CD

#### GitHub Actions Ready
The containerized setup is designed for seamless CI/CD integration:

```yaml
# Example GitHub Actions step
- name: Run Tests
  run: |
    chmod +x ./test-runner.sh
    ./test-runner.sh
    
- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    file: ./backend/coverage/lcov.info
```

### Security Considerations

#### Test Data Privacy
- All test data is synthetic and anonymized
- No real census data used in testing
- Test API keys are clearly marked and non-functional

#### Network Security
- Test containers use isolated Docker network
- No external network access during tests
- Mock services prevent accidental real API calls

### Future Enhancements

#### Planned Improvements
- [ ] Increase test coverage to 95%+
- [ ] Add performance benchmarking
- [ ] Implement frontend E2E testing with Playwright
- [ ] Add security scanning to test pipeline
- [ ] Implement load testing scenarios

#### Monitoring Integration
- [ ] Add test execution metrics
- [ ] Implement test flakiness tracking
- [ ] Create test performance dashboards

### Getting Help

#### Documentation
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Jest Testing Framework](https://jestjs.io/docs/getting-started)
- [WireMock Documentation](https://wiremock.org/docs/)

#### Support
For testing infrastructure issues:
1. Check container logs first
2. Verify Docker Desktop is running
3. Clear Docker cache if builds fail
4. Review test output for specific failures

This infrastructure provides enterprise-grade testing capabilities that scale from local development to production CI/CD pipelines.