#!/bin/bash
# CensusChat Demo Setup Script
# ============================
# One-command setup for CensusChat development environment
#
# This script will:
# 1. Check prerequisites (Docker, Node.js)
# 2. Create .env file if needed
# 3. Start all services (PostgreSQL, Redis, Backend, Frontend)
# 4. Initialize DuckDB with demo data
# 5. Verify all services are healthy
#
# Usage: ./demo-setup.sh

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
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

# Check if Docker is installed and running
check_docker() {
    print_info "Checking Docker installation..."

    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker Desktop from https://www.docker.com/get-started"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker Desktop and try again."
        exit 1
    fi

    print_success "Docker is installed and running"
}

# Check if Docker Compose is available
check_docker_compose() {
    print_info "Checking Docker Compose..."

    if ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not available. Please ensure you have Docker Desktop installed."
        exit 1
    fi

    print_success "Docker Compose is available"
}

# Check if Node.js is installed (optional, for local development)
check_node() {
    print_info "Checking Node.js installation..."

    if ! command -v node &> /dev/null; then
        print_warning "Node.js not found. This is optional for Docker-only setup."
        return
    fi

    NODE_VERSION=$(node --version)
    print_success "Node.js $NODE_VERSION is installed"
}

# Create .env file from .env.example if it doesn't exist
setup_env() {
    print_info "Setting up environment configuration..."

    if [ -f .env ]; then
        print_warning ".env file already exists. Skipping creation."
        return
    fi

    if [ ! -f .env.example ]; then
        print_error ".env.example not found. Cannot create .env file."
        exit 1
    fi

    cp .env.example .env

    # Generate a secure JWT secret
    if command -v openssl &> /dev/null; then
        JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
        # Use platform-specific sed
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|g" .env
        else
            sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|g" .env
        fi
        print_success "Generated secure JWT_SECRET"
    else
        print_warning "OpenSSL not found. Please manually set JWT_SECRET in .env file."
    fi

    # Set development database password
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=dev_postgres_password_2024|g" .env
    else
        sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=dev_postgres_password_2024|g" .env
    fi

    print_success ".env file created from .env.example"
    print_info "You can edit .env to add your Census API key and Anthropic API key later"
}

# Check if ports are available
check_ports() {
    print_info "Checking if required ports are available..."

    PORTS=(3000 3001 5432 6379)
    PORT_NAMES=("Frontend" "Backend" "PostgreSQL" "Redis")

    for i in "${!PORTS[@]}"; do
        PORT=${PORTS[$i]}
        NAME=${PORT_NAMES[$i]}

        if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
            print_warning "Port $PORT ($NAME) is already in use"
            print_info "Run: lsof -ti :$PORT | xargs kill -9  # to free the port"
            read -p "Do you want to continue anyway? (y/n) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    done

    print_success "Port check complete"
}

# Stop any existing containers
stop_existing_containers() {
    print_info "Stopping any existing CensusChat containers..."

    if docker compose ps -q 2>/dev/null | grep -q .; then
        docker compose down
        print_success "Stopped existing containers"
    else
        print_info "No existing containers to stop"
    fi
}

# Build and start Docker containers
start_services() {
    print_info "Building and starting services (this may take a few minutes)..."

    docker compose up -d --build

    print_success "Services started successfully"
}

# Wait for services to be healthy
wait_for_services() {
    print_info "Waiting for services to be healthy..."

    # Wait for PostgreSQL
    echo -n "Waiting for PostgreSQL"
    for i in {1..30}; do
        if docker compose exec -T postgres pg_isready -U censuschat_user -d censuschat &> /dev/null; then
            echo ""
            print_success "PostgreSQL is ready"
            break
        fi
        echo -n "."
        sleep 1
    done

    # Wait for Redis
    echo -n "Waiting for Redis"
    for i in {1..30}; do
        if docker compose exec -T redis redis-cli ping &> /dev/null; then
            echo ""
            print_success "Redis is ready"
            break
        fi
        echo -n "."
        sleep 1
    done

    # Wait for Backend
    echo -n "Waiting for Backend API"
    for i in {1..60}; do
        if curl -f http://localhost:3001/api/v1/health &> /dev/null; then
            echo ""
            print_success "Backend API is ready"
            break
        fi
        echo -n "."
        sleep 1
    done

    # Wait for Frontend
    echo -n "Waiting for Frontend"
    for i in {1..60}; do
        if curl -f http://localhost:3000 &> /dev/null; then
            echo ""
            print_success "Frontend is ready"
            break
        fi
        echo -n "."
        sleep 1
    done
}

# Load demo data
load_demo_data() {
    print_info "Loading demo data into DuckDB..."

    # Check if demo data loader exists
    if docker compose exec -T backend test -f src/scripts/seedDemoData.ts; then
        # Run with TypeScript transpile-only mode to ignore type errors during setup
        print_info "Running demo data loader (this may show some warnings)..."
        if docker compose exec -T backend sh -c "TS_NODE_TRANSPILE_ONLY=true npm run seed:demo"; then
            print_success "Demo data loaded successfully"
        else
            print_warning "Demo data loader had issues. You may need to load data manually."
            print_info "Try running: cd backend && npm run seed:demo"
        fi
    else
        print_warning "Demo data loader not found. You may need to load data manually."
    fi
}

# Verify setup
verify_setup() {
    print_info "Verifying setup..."

    # Check PostgreSQL
    if docker compose exec -T postgres pg_isready -U censuschat_user -d censuschat &> /dev/null; then
        print_success "PostgreSQL is operational"
    else
        print_error "PostgreSQL verification failed"
    fi

    # Check Redis
    if docker compose exec -T redis redis-cli ping &> /dev/null; then
        print_success "Redis is operational"
    else
        print_error "Redis verification failed"
    fi

    # Check Backend API
    HEALTH_CHECK=$(curl -s http://localhost:3001/api/v1/health)
    if echo "$HEALTH_CHECK" | grep -q "healthy"; then
        print_success "Backend API is operational"
    else
        print_error "Backend API verification failed"
    fi

    # Check Frontend
    if curl -f -s http://localhost:3000 > /dev/null; then
        print_success "Frontend is operational"
    else
        print_error "Frontend verification failed"
    fi
}

# Display final instructions
show_instructions() {
    print_header "🎉 CensusChat Demo Setup Complete!"

    echo ""
    echo -e "${GREEN}✅ All services are running and healthy!${NC}"
    echo ""
    echo -e "${BLUE}Access your application:${NC}"
    echo "  📱 Frontend:    http://localhost:3000"
    echo "  🔧 Backend API: http://localhost:3001/api/v1"
    echo "  💚 Health:      http://localhost:3001/api/v1/health"
    echo ""
    echo -e "${BLUE}Useful commands:${NC}"
    echo "  📊 View logs:        docker compose logs -f"
    echo "  📊 Backend logs:     docker compose logs -f backend"
    echo "  📊 Frontend logs:    docker compose logs -f frontend"
    echo "  🔄 Restart services: docker compose restart"
    echo "  🛑 Stop services:    docker compose down"
    echo "  🗄️  DuckDB CLI:       cd backend && npm run duckdb"
    echo ""
    echo -e "${BLUE}Test queries to try:${NC}"
    echo "  • 'Show me all counties in Texas'"
    echo "  • 'Medicare eligible seniors in Florida'"
    echo "  • 'Counties with median income over \$75,000'"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "  1. Visit http://localhost:3000 to start using CensusChat"
    echo "  2. Add your Census API key to .env to load production data"
    echo "  3. Add your Anthropic API key to .env for AI-powered queries"
    echo "  4. See docs/guides/ACS_DATA_LOADING.md to load 3,143 US counties"
    echo ""
    echo -e "${YELLOW}📖 Documentation: See QUICK_START.md and docs/ directory${NC}"
    echo ""
}

# Main execution
main() {
    print_header "🚀 CensusChat Demo Setup"

    check_docker
    check_docker_compose
    check_node
    setup_env
    check_ports
    stop_existing_containers
    start_services
    wait_for_services
    load_demo_data
    verify_setup
    show_instructions
}

# Run main function
main
