# DuckDB Test Data Management System
## Data Ops Engineering - Snapshot-Based Testing

This directory contains the DuckDB test data management system that provides:
- **Snapshot Management**: Reproducible database states for testing
- **Fixture Libraries**: Curated test datasets for different scenarios
- **Performance Optimization**: Fast data loading and reset capabilities
- **Isolation**: Each test gets a clean data environment

## Directory Structure

```
test-data/duckdb/
├── snapshots/           # Database snapshot files (.db)
│   ├── clean-state.db   # Empty database with schema
│   ├── foundation.db    # Basic Census data loaded
│   └── full-dataset.db  # Complete test dataset
├── fixtures/            # JSON/CSV test data files
│   ├── census-api/      # Mock Census API responses
│   ├── validation/      # Data validation test cases  
│   └── user-data/       # Test user accounts and sessions
├── schemas/             # Database schema definitions
├── migrations/          # Test data migration scripts
└── scripts/             # Automation and utility scripts
```

## Snapshot Strategy

### 1. **Clean State** (`clean-state.db`)
- Empty database with full schema
- Used for: Schema validation, migration testing
- Size: ~1MB, Load time: <100ms

### 2. **Foundation State** (`foundation.db`)  
- Basic Census geographic data (states, counties)
- Core reference tables populated
- Used for: Unit tests, API validation
- Size: ~50MB, Load time: <500ms

### 3. **Full Dataset** (`full-dataset.db`)
- Representative sample of Census data
- Multiple years, geographies, demographics
- Used for: Integration tests, performance testing
- Size: ~500MB, Load time: <2s

## Usage Patterns

### Test Isolation
Each test container gets its own snapshot copy:
```bash
# Before test: Copy snapshot
cp /data/snapshots/foundation.db /test-instance/test.db

# During test: Work with isolated copy
# After test: Discard copy (automatic cleanup)
```

### Parallel Testing
Multiple test runners can work simultaneously:
- Each gets isolated snapshot copy
- No shared state conflicts
- Predictable test outcomes

### Performance Benefits
- **Fast Reset**: Copy snapshot vs. rebuild from scratch
- **Deterministic**: Same starting state every time
- **Scalable**: Snapshots support any data volume

## Automation Scripts

Located in `/scripts/` directory:
- `create-snapshot.sh` - Generate new snapshots
- `validate-snapshot.sh` - Verify snapshot integrity  
- `load-fixtures.sh` - Populate database from fixtures
- `cleanup-snapshots.sh` - Remove old/unused snapshots