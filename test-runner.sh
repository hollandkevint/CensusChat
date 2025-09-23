#!/bin/bash
# CensusChat Docker Test Runner
# Data Ops Engineer - Testing Infrastructure

set -e

echo "🔧 CensusChat Docker Test Environment"
echo "======================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_success "Docker is running"
}

# Function to cleanup previous test containers
cleanup() {
    print_status "Cleaning up previous test containers..."
    docker-compose -f docker-compose.test.yml down --volumes --remove-orphans >/dev/null 2>&1 || true
    docker system prune -f >/dev/null 2>&1 || true
}

# Function to setup test data directories
setup_test_data() {
    print_status "Setting up test data directories..."
    
    # Create test data directories
    mkdir -p test-data/{duckdb,postgres-init,census-fixtures,wiremock/{mappings,files},seed-scripts}
    
    print_success "Test data directories created"
}

# Function to run specific test type
run_tests() {
    local test_type=$1
    
    case $test_type in
        "unit")
            print_status "Running unit tests..."
            docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit backend-test
            ;;
        "integration")
            print_status "Running integration tests..."
            docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit integration-test
            ;;
        "frontend")
            print_status "Running frontend tests..."
            docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit frontend-test
            ;;
        "all")
            print_status "Running all tests..."
            docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit
            ;;
        "seed")
            print_status "Seeding test data..."
            docker-compose -f docker-compose.test.yml up --build test-data-seeder
            ;;
        *)
            print_error "Unknown test type: $test_type"
            print_status "Available types: unit, integration, frontend, all, seed"
            exit 1
            ;;
    esac
}

# Function to show test results
show_results() {
    print_status "Test Results Summary:"
    
    # Check if coverage directory exists and show coverage
    if [ -d "./backend/coverage" ]; then
        print_status "Backend test coverage generated at: ./backend/coverage/lcov-report/index.html"
    fi
    
    # Show container logs for debugging
    print_status "Container logs available via:"
    echo "  docker-compose -f docker-compose.test.yml logs [service-name]"
}

# Main execution
main() {
    local test_type=${1:-"all"}
    
    print_status "Starting CensusChat test run (type: $test_type)"
    
    check_docker
    cleanup
    setup_test_data
    
    # Start infrastructure services first
    print_status "Starting test infrastructure..."
    docker-compose -f docker-compose.test.yml up -d test-postgres test-redis census-api-mock test-duckdb
    
    # Wait for services to be healthy
    print_status "Waiting for services to be ready..."
    sleep 10
    
    # Run the requested tests
    run_tests $test_type
    
    show_results
    
    print_success "Test run completed!"
    print_warning "Remember to run 'docker-compose -f docker-compose.test.yml down --volumes' to cleanup when done"
}

# Help function
show_help() {
    echo "Usage: ./test-runner.sh [TEST_TYPE]"
    echo ""
    echo "TEST_TYPE options:"
    echo "  unit        - Run backend unit tests only"
    echo "  integration - Run backend integration tests"
    echo "  frontend    - Run frontend tests"
    echo "  seed        - Seed test data only"
    echo "  all         - Run all tests (default)"
    echo ""
    echo "Examples:"
    echo "  ./test-runner.sh unit"
    echo "  ./test-runner.sh integration"
    echo "  ./test-runner.sh"
    echo ""
    echo "Additional commands:"
    echo "  ./test-runner.sh --cleanup  - Cleanup test containers only"
    echo "  ./test-runner.sh --help     - Show this help"
}

# Handle command line arguments
if [[ $# -gt 1 ]]; then
    print_error "Too many arguments"
    show_help
    exit 1
fi

case $1 in
    "--help"|"-h")
        show_help
        exit 0
        ;;
    "--cleanup")
        cleanup
        print_success "Cleanup completed"
        exit 0
        ;;
    *)
        main $1
        ;;
esac