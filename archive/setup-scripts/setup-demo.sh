#!/bin/bash
# CensusChat Demo Setup Script
# Sets up Docker containers with DuckDB for localhost deployment and demoing

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[SETUP]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_demo() { echo -e "${PURPLE}[DEMO]${NC} $1"; }

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.demo.yml"

# Check if Docker is running
check_docker() {
    print_status "Checking Docker installation..."
    
    if ! command -v docker >/dev/null 2>&1; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    print_success "Docker is running"
}

# Check if Docker Compose is available
check_docker_compose() {
    print_status "Checking Docker Compose..."
    
    if ! command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
        print_error "Docker Compose is not available. Please install Docker Compose."
        exit 1
    fi
    
    # Use docker compose (newer) if available, otherwise docker-compose
    if docker compose version >/dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi
    
    print_success "Docker Compose is available"
}

# Create necessary directories
create_directories() {
    print_status "Creating necessary directories..."
    
    cd "$PROJECT_ROOT"
    
    # Create data directory
    mkdir -p data
    mkdir -p temp/exports
    mkdir -p test-data/snapshots
    
    # Set permissions
    chmod 755 data temp test-data
    
    print_success "Directories created"
}

# Create environment file if it doesn't exist
setup_environment() {
    print_status "Setting up environment configuration..."
    
    cd "$PROJECT_ROOT"
    
    if [[ ! -f .env ]]; then
        if [[ -f env.example ]]; then
            cp env.example .env
            print_success "Created .env file from env.example"
        else
            print_warning "No env.example found, using Docker Compose defaults"
        fi
    else
        print_success ".env file already exists"
    fi
}

# Build and start services
start_services() {
    print_status "Building and starting Docker services..."
    
    cd "$PROJECT_ROOT"
    
    # Stop any existing containers
    print_status "Stopping existing containers..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" down --remove-orphans || true
    
    # Build and start services
    print_status "Building Docker images..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" build --no-cache
    
    print_status "Starting services..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" up -d
    
    print_success "Services started"
}

# Wait for services to be healthy
wait_for_services() {
    print_status "Waiting for services to be healthy..."
    
    local max_attempts=60
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        print_status "Health check attempt $attempt/$max_attempts..."
        
        # Check if all services are healthy
        local unhealthy_services=$($COMPOSE_CMD -f "$COMPOSE_FILE" ps --format "table {{.Name}}\t{{.Status}}" | grep -v "healthy" | grep -v "exited" | wc -l)
        
        if [[ $unhealthy_services -eq 0 ]]; then
            print_success "All services are healthy!"
            return 0
        fi
        
        sleep 5
        ((attempt++))
    done
    
    print_warning "Some services may not be fully healthy, but continuing..."
}

# Create DuckDB snapshots
create_duckdb_snapshots() {
    print_status "Creating DuckDB snapshots for demo..."
    
    cd "$PROJECT_ROOT"
    
    # Check if DuckDB is available in the container
    if docker exec censuschat-backend-demo which duckdb >/dev/null 2>&1; then
        print_status "Creating demo DuckDB snapshots..."
        docker exec censuschat-backend-demo sh -c "
            cd /app/test-data/duckdb/scripts &&
            chmod +x create-snapshot.sh &&
            ./create-snapshot.sh foundation
        " || print_warning "DuckDB snapshot creation failed, using fallback"
    else
        print_warning "DuckDB not available in container, using fallback data"
    fi
}

# Display demo information
show_demo_info() {
    print_demo "🎉 CensusChat Demo Setup Complete!"
    echo ""
    print_demo "📊 Application URLs:"
    echo "   Frontend: http://localhost:3000"
    echo "   Backend API: http://localhost:3001"
    echo "   API Documentation: http://localhost:3001/api/v1"
    echo ""
    print_demo "🗄️  Database Access:"
    echo "   PostgreSQL: localhost:5432 (censuschat_demo/censuschat_user)"
    echo "   Redis: localhost:6379"
    echo "   DuckDB: ./data/census.duckdb"
    echo ""
    print_demo "🛠️  Management Tools:"
    echo "   pgAdmin: http://localhost:5050 (admin@localhost/admin_password_2024)"
    echo "   RedisInsight: http://localhost:8001"
    echo ""
    print_demo "📋 Demo Commands:"
    echo "   View logs: $COMPOSE_CMD -f $COMPOSE_FILE logs -f"
    echo "   Stop services: $COMPOSE_CMD -f $COMPOSE_FILE down"
    echo "   Restart services: $COMPOSE_CMD -f $COMPOSE_FILE restart"
    echo "   View status: $COMPOSE_CMD -f $COMPOSE_FILE ps"
    echo ""
    print_demo "🧪 Test the Export Feature:"
    echo "   1. Open http://localhost:3000"
    echo "   2. Ask: 'Show me population data for Florida'"
    echo "   3. Click the Export button on results"
    echo "   4. Choose Excel format and watch progress"
    echo ""
    print_demo "📁 Data Files:"
    echo "   DuckDB: $PROJECT_ROOT/data/census.duckdb"
    echo "   Exports: $PROJECT_ROOT/temp/exports/"
    echo "   Logs: $COMPOSE_CMD -f $COMPOSE_FILE logs"
}

# Cleanup function
cleanup() {
    print_status "Cleaning up on exit..."
    # Add any cleanup tasks here
}

# Main execution
main() {
    print_demo "🚀 CensusChat Demo Setup Starting..."
    echo ""
    
    # Set up cleanup trap
    trap cleanup EXIT
    
    # Run setup steps
    check_docker
    check_docker_compose
    create_directories
    setup_environment
    start_services
    wait_for_services
    create_duckdb_snapshots
    
    echo ""
    show_demo_info
    
    print_success "Demo setup completed successfully! 🎉"
}

# Help function
show_help() {
    echo "CensusChat Demo Setup Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --help, -h     Show this help message"
    echo "  --clean        Clean up existing containers before setup"
    echo "  --no-build     Skip Docker image building"
    echo "  --logs         Show logs after setup"
    echo ""
    echo "Examples:"
    echo "  $0                    # Full setup"
    echo "  $0 --clean           # Clean setup"
    echo "  $0 --no-build        # Skip building (faster)"
    echo "  $0 --logs            # Show logs after setup"
}

# Handle arguments
CLEAN=false
NO_BUILD=false
SHOW_LOGS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            show_help
            exit 0
            ;;
        --clean)
            CLEAN=true
            shift
            ;;
        --no-build)
            NO_BUILD=true
            shift
            ;;
        --logs)
            SHOW_LOGS=true
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Run main function
main

# Show logs if requested
if [[ "$SHOW_LOGS" == "true" ]]; then
    echo ""
    print_status "Showing service logs..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" logs -f
fi

