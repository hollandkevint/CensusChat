#!/bin/bash
# DuckDB Snapshot Creation Script
# Data Ops Engineering - Test Data Management

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$(dirname "$SCRIPT_DIR")"
SNAPSHOTS_DIR="$DATA_DIR/snapshots"
FIXTURES_DIR="$DATA_DIR/fixtures"
SCHEMAS_DIR="$DATA_DIR/schemas"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[SNAPSHOT]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Create directories if they don't exist
mkdir -p "$SNAPSHOTS_DIR" "$FIXTURES_DIR" "$SCHEMAS_DIR"

# Function to create clean state snapshot
create_clean_snapshot() {
    local snapshot_name="clean-state.db"
    local snapshot_path="$SNAPSHOTS_DIR/$snapshot_name"
    
    print_status "Creating clean state snapshot: $snapshot_name"
    
    # Remove existing snapshot
    rm -f "$snapshot_path"
    
    # Create new empty database with schema
    cat > /tmp/clean-schema.sql << 'EOF'
-- CensusChat Clean State Schema
-- Core tables without data

-- Geographic reference tables
CREATE TABLE states (
    code VARCHAR(2) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    fips_code VARCHAR(2) NOT NULL
);

CREATE TABLE counties (
    fips_code VARCHAR(5) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    state_code VARCHAR(2) NOT NULL,
    FOREIGN KEY (state_code) REFERENCES states(code)
);

-- Census data tables
CREATE TABLE census_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    geography_type VARCHAR(20) NOT NULL,
    geography_code VARCHAR(20) NOT NULL,
    variable_code VARCHAR(50) NOT NULL,
    value DOUBLE,
    margin_of_error DOUBLE,
    year INTEGER NOT NULL,
    dataset VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User and session tables
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Query history
CREATE TABLE query_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    query_text TEXT NOT NULL,
    query_type VARCHAR(50),
    response_data JSON,
    execution_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX idx_census_data_geography ON census_data(geography_type, geography_code);
CREATE INDEX idx_census_data_variable ON census_data(variable_code);
CREATE INDEX idx_census_data_year ON census_data(year);
CREATE INDEX idx_query_history_user ON query_history(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(token);
EOF

    # Create database with schema
    duckdb "$snapshot_path" < /tmp/clean-schema.sql
    
    # Cleanup temp file
    rm -f /tmp/clean-schema.sql
    
    local size=$(ls -lh "$snapshot_path" | awk '{print $5}')
    print_success "Clean state snapshot created: $size"
}

# Function to create foundation snapshot with basic data
create_foundation_snapshot() {
    local snapshot_name="foundation.db"
    local snapshot_path="$SNAPSHOTS_DIR/$snapshot_name"
    
    print_status "Creating foundation snapshot: $snapshot_name"
    
    # Start with clean snapshot
    cp "$SNAPSHOTS_DIR/clean-state.db" "$snapshot_path"
    
    # Load foundation data
    cat > /tmp/foundation-data.sql << 'EOF'
-- Foundation Data Loading
-- Basic geographic and reference data

-- US States
INSERT INTO states (code, name, fips_code) VALUES
('AL', 'Alabama', '01'),
('AK', 'Alaska', '02'),
('AZ', 'Arizona', '04'),
('AR', 'Arkansas', '05'),
('CA', 'California', '06'),
('CO', 'Colorado', '08'),
('CT', 'Connecticut', '09'),
('DE', 'Delaware', '10'),
('FL', 'Florida', '12'),
('GA', 'Georgia', '13'),
('HI', 'Hawaii', '15'),
('ID', 'Idaho', '16'),
('IL', 'Illinois', '17'),
('IN', 'Indiana', '18'),
('IA', 'Iowa', '19'),
('KS', 'Kansas', '20'),
('KY', 'Kentucky', '21'),
('LA', 'Louisiana', '22'),
('ME', 'Maine', '23'),
('MD', 'Maryland', '24'),
('MA', 'Massachusetts', '25'),
('MI', 'Michigan', '26'),
('MN', 'Minnesota', '27'),
('MS', 'Mississippi', '28'),
('MO', 'Missouri', '29'),
('MT', 'Montana', '30'),
('NE', 'Nebraska', '31'),
('NV', 'Nevada', '32'),
('NH', 'New Hampshire', '33'),
('NJ', 'New Jersey', '34'),
('NM', 'New Mexico', '35'),
('NY', 'New York', '36'),
('NC', 'North Carolina', '37'),
('ND', 'North Dakota', '38'),
('OH', 'Ohio', '39'),
('OK', 'Oklahoma', '40'),
('OR', 'Oregon', '41'),
('PA', 'Pennsylvania', '42'),
('RI', 'Rhode Island', '44'),
('SC', 'South Carolina', '45'),
('SD', 'South Dakota', '46'),
('TN', 'Tennessee', '47'),
('TX', 'Texas', '48'),
('UT', 'Utah', '49'),
('VT', 'Vermont', '50'),
('VA', 'Virginia', '51'),
('WA', 'Washington', '53'),
('WV', 'West Virginia', '54'),
('WI', 'Wisconsin', '55'),
('WY', 'Wyoming', '56');

-- Sample counties (major metropolitan areas)
INSERT INTO counties (fips_code, name, state_code) VALUES
('06037', 'Los Angeles County', 'CA'),
('17031', 'Cook County', 'IL'),
('48201', 'Harris County', 'TX'),
('04013', 'Maricopa County', 'AZ'),
('06073', 'San Diego County', 'CA'),
('06059', 'Orange County', 'CA'),
('12086', 'Miami-Dade County', 'FL'),
('36047', 'Kings County', 'NY'),
('53033', 'King County', 'WA'),
('36061', 'New York County', 'NY');

-- Sample test users
INSERT INTO users (id, email, password_hash) VALUES
(gen_random_uuid(), 'test@example.com', '$2a$10$test.hash.for.testing.only'),
(gen_random_uuid(), 'admin@example.com', '$2a$10$admin.hash.for.testing.only');
EOF

    # Apply foundation data
    duckdb "$snapshot_path" < /tmp/foundation-data.sql
    
    # Cleanup temp file
    rm -f /tmp/foundation-data.sql
    
    local size=$(ls -lh "$snapshot_path" | awk '{print $5}')
    print_success "Foundation snapshot created: $size"
}

# Function to create full dataset snapshot
create_full_snapshot() {
    local snapshot_name="full-dataset.db"
    local snapshot_path="$SNAPSHOTS_DIR/$snapshot_name"
    
    print_status "Creating full dataset snapshot: $snapshot_name"
    
    # Start with foundation snapshot
    cp "$SNAPSHOTS_DIR/foundation.db" "$snapshot_path"
    
    # Generate sample census data
    cat > /tmp/full-dataset.sql << 'EOF'
-- Full Dataset Loading
-- Representative sample of Census data for testing

-- Generate sample census data
INSERT INTO census_data (geography_type, geography_code, variable_code, value, margin_of_error, year, dataset)
SELECT 
    'state' as geography_type,
    fips_code as geography_code,
    'B01001_001E' as variable_code,  -- Total Population
    (random() * 10000000 + 500000)::INTEGER as value,
    (random() * 50000 + 1000)::INTEGER as margin_of_error,
    2020 as year,
    'acs5' as dataset
FROM states;

INSERT INTO census_data (geography_type, geography_code, variable_code, value, margin_of_error, year, dataset)
SELECT 
    'state' as geography_type,
    fips_code as geography_code,
    'B19013_001E' as variable_code,  -- Median Household Income
    (random() * 50000 + 30000)::INTEGER as value,
    (random() * 2000 + 500)::INTEGER as margin_of_error,
    2020 as year,
    'acs5' as dataset
FROM states;

INSERT INTO census_data (geography_type, geography_code, variable_code, value, margin_of_error, year, dataset)
SELECT 
    'county' as geography_type,
    fips_code as geography_code,
    'B01001_001E' as variable_code,  -- Total Population
    (random() * 2000000 + 50000)::INTEGER as value,
    (random() * 10000 + 500)::INTEGER as margin_of_error,
    2020 as year,
    'acs5' as dataset
FROM counties;

-- Generate sample query history
INSERT INTO query_history (user_id, query_text, query_type, response_data, execution_time_ms)
SELECT 
    u.id as user_id,
    'What is the population of ' || s.name || '?' as query_text,
    'population_query' as query_type,
    json_object('state', s.name, 'population', (random() * 10000000 + 500000)::INTEGER) as response_data,
    (random() * 1000 + 100)::INTEGER as execution_time_ms
FROM users u, states s
WHERE random() < 0.1  -- Sample some queries
LIMIT 50;
EOF

    # Apply full dataset
    duckdb "$snapshot_path" < /tmp/full-dataset.sql
    
    # Cleanup temp file
    rm -f /tmp/full-dataset.sql
    
    local size=$(ls -lh "$snapshot_path" | awk '{print $5}')
    print_success "Full dataset snapshot created: $size"
}

# Function to validate snapshots
validate_snapshots() {
    print_status "Validating snapshots..."
    
    for snapshot in "$SNAPSHOTS_DIR"/*.db; do
        if [[ -f "$snapshot" ]]; then
            local name=$(basename "$snapshot")
            local integrity_check=$(duckdb "$snapshot" "PRAGMA integrity_check;")
            
            if [[ "$integrity_check" == "ok" ]]; then
                local size=$(ls -lh "$snapshot" | awk '{print $5}')
                local tables=$(duckdb "$snapshot" "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'main';" | tail -1)
                print_success "$name validated - Size: $size, Tables: $tables"
            else
                print_error "$name failed integrity check"
                return 1
            fi
        fi
    done
}

# Main execution
main() {
    local snapshot_type=${1:-"all"}
    
    print_status "DuckDB Snapshot Creation (type: $snapshot_type)"
    
    # Check if DuckDB is available
    if ! command -v duckdb >/dev/null 2>&1; then
        print_error "DuckDB is not installed or not in PATH"
        exit 1
    fi
    
    case $snapshot_type in
        "clean")
            create_clean_snapshot
            ;;
        "foundation")
            create_clean_snapshot
            create_foundation_snapshot
            ;;
        "full")
            create_clean_snapshot
            create_foundation_snapshot
            create_full_snapshot
            ;;
        "all"|*)
            create_clean_snapshot
            create_foundation_snapshot
            create_full_snapshot
            ;;
    esac
    
    validate_snapshots
    
    print_success "Snapshot creation completed successfully!"
}

# Help function
show_help() {
    echo "Usage: $0 [SNAPSHOT_TYPE]"
    echo ""
    echo "SNAPSHOT_TYPE options:"
    echo "  clean       - Create only clean state snapshot"
    echo "  foundation  - Create clean + foundation snapshots"
    echo "  full        - Create clean + foundation + full dataset"
    echo "  all         - Create all snapshots (default)"
    echo ""
    echo "Examples:"
    echo "  $0 clean"
    echo "  $0 foundation"
    echo "  $0"
}

# Handle arguments
case $1 in
    "--help"|"-h")
        show_help
        exit 0
        ;;
    *)
        main $1
        ;;
esac