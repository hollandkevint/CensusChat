#!/bin/bash

# CensusChat Database Setup Script
# This script loads all required Census data into DuckDB
# Run this after initial setup to populate the database with real data

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check prerequisites
print_header "🔍 Checking Prerequisites"

if [ ! -f ".env" ]; then
    print_error ".env file not found in backend directory"
    print_info "Please copy .env.example to .env and configure your Census API key"
    exit 1
fi

# Check for Census API key
if ! grep -q "CENSUS_API_KEY=" .env || grep -q "CENSUS_API_KEY=$" .env || grep -q "CENSUS_API_KEY=your-" .env; then
    print_error "Census API key not configured in .env file"
    print_info "Get a free API key from: https://api.census.gov/data/key_signup.html"
    print_info "Then add it to backend/.env: CENSUS_API_KEY=your-key-here"
    exit 1
fi

print_success "Census API key configured"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_warning "Dependencies not installed. Running npm install..."
    npm install
    print_success "Dependencies installed"
fi

# Create data directory if it doesn't exist
mkdir -p data
print_success "Data directory ready"

print_header "📊 Loading Census Data"

print_info "This process will take 2-3 hours to complete"
print_info "Data to be loaded:"
print_info "  - Block Group Data: 239,741 records × 84 variables"
print_info "  - All 50 states + DC"
print_info ""
print_info "You can monitor progress in another terminal with:"
print_info "  tail -f data/blockgroup-expanded-progress.json"
print_info ""

# Ask for confirmation
read -p "Continue with data loading? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Data loading cancelled"
    exit 0
fi

# Load expanded block group data
print_header "🚀 Loading Block Group Data (84 variables)"
print_info "Starting data load..."

if npm run load-blockgroups-expanded; then
    print_success "Block group data loaded successfully!"
else
    print_error "Failed to load block group data"
    print_info "Check logs above for error details"
    exit 1
fi

# Verify data loaded
print_header "🔍 Verifying Data"

# Check if we can query the database
if command -v duckdb &> /dev/null; then
    RECORD_COUNT=$(duckdb data/census.duckdb "SELECT COUNT(*) FROM block_group_data_expanded" 2>/dev/null | tail -n 1 || echo "0")

    if [ "$RECORD_COUNT" -gt 0 ]; then
        print_success "Data verified: $RECORD_COUNT block groups loaded"

        # Show sample by state
        print_info "Top 5 states by block group count:"
        duckdb data/census.duckdb "SELECT state_name, COUNT(*) as count FROM block_group_data_expanded GROUP BY state_name ORDER BY count DESC LIMIT 5" 2>/dev/null || true
    else
        print_warning "No data found in block_group_data_expanded table"
    fi
else
    print_warning "DuckDB CLI not installed - skipping verification"
    print_info "Install with: brew install duckdb (Mac) or see https://duckdb.org"
fi

# Clean up progress file if complete
if [ -f "data/blockgroup-expanded-progress.json" ]; then
    rm data/blockgroup-expanded-progress.json
    print_info "Cleaned up progress tracking file"
fi

print_header "✅ Database Setup Complete!"
print_success "Your CensusChat database is ready to use"
print_info ""
print_info "Next steps:"
print_info "  1. Start the backend: npm run dev"
print_info "  2. Start the frontend: cd ../frontend && npm run dev"
print_info "  3. Open http://localhost:3000"
print_info ""
print_info "Try queries like:"
print_info "  - 'Medicare eligible seniors in California with income over $75k'"
print_info "  - 'Block groups in Florida with high uninsured rates'"
print_info "  - 'Highest density neighborhoods for Medicaid population in Texas'"
print_info ""
