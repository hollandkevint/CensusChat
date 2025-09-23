#!/bin/bash

# CensusChat MVP Setup Verification Script
# =======================================

set -e

echo "🔍 CensusChat MVP Setup Verification"
echo "===================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[CHECK]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check Docker availability
print_status "Checking Docker installation..."
if command -v docker &> /dev/null; then
    print_success "Docker is installed"
else
    print_error "Docker is not installed"
    exit 1
fi

# Check Docker Compose
print_status "Checking Docker Compose..."
if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
    print_success "Docker Compose is available"
else
    print_error "Docker Compose is not available"
    exit 1
fi

# Check if Docker daemon is running
print_status "Checking Docker daemon..."
if docker info &> /dev/null; then
    print_success "Docker daemon is running"
else
    print_error "Docker daemon is not running"
    exit 1
fi

# Validate Docker Compose configuration
print_status "Validating Docker Compose configuration..."
if docker-compose -f docker-compose.mvp.yml config --quiet; then
    print_success "Docker Compose configuration is valid"
else
    print_error "Docker Compose configuration has errors"
    exit 1
fi

# Check required files
print_status "Checking required files..."

required_files=(
    "docker-compose.mvp.yml"
    "backend/Dockerfile.mvp"
    "frontend/Dockerfile.mvp"
    ".env.mvp"
    "start-mvp.sh"
)

for file in "${required_files[@]}"; do
    if [[ -f "$file" ]]; then
        print_success "$file exists"
    else
        print_error "$file is missing"
        exit 1
    fi
done

# Check if .env file exists
print_status "Checking environment configuration..."
if [[ -f ".env" ]]; then
    print_success ".env file exists"

    # Check for required environment variables
    if grep -q "ANTHROPIC_API_KEY=" .env; then
        if grep -q "ANTHROPIC_API_KEY=$" .env || grep -q "ANTHROPIC_API_KEY=\"\"" .env; then
            print_warning "ANTHROPIC_API_KEY is not set in .env file"
        else
            print_success "ANTHROPIC_API_KEY is configured"
        fi
    else
        print_warning "ANTHROPIC_API_KEY not found in .env file"
    fi
else
    print_warning ".env file not found - will be created from template"
fi

# Check if ports are available
print_status "Checking port availability..."

check_port() {
    local port=$1
    local service=$2

    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        print_warning "Port $port is already in use (needed for $service)"
        lsof -Pi :$port -sTCP:LISTEN
    else
        print_success "Port $port is available for $service"
    fi
}

check_port 3000 "Frontend"
check_port 3001 "Backend"
check_port 5432 "PostgreSQL"
check_port 6379 "Redis"

# Check directory structure
print_status "Checking directory structure..."

required_dirs=(
    "backend/src"
    "frontend/src"
)

for dir in "${required_dirs[@]}"; do
    if [[ -d "$dir" ]]; then
        print_success "$dir directory exists"
    else
        print_error "$dir directory is missing"
        exit 1
    fi
done

# Create data and logs directories if they don't exist
mkdir -p data logs
print_success "Data and logs directories are ready"

# Test Docker image builds (optional quick test)
print_status "Testing Docker image build capability..."
if docker build -f backend/Dockerfile.mvp -t censuschat-backend-test --target builder backend/ >/dev/null 2>&1; then
    print_success "Backend Docker build test passed"
    docker rmi censuschat-backend-test >/dev/null 2>&1 || true
else
    print_warning "Backend Docker build test failed (might be due to missing dependencies)"
fi

echo ""
print_success "🎉 MVP setup verification completed!"
echo ""
echo "📋 Summary:"
echo "   ✅ Docker environment is ready"
echo "   ✅ All required files are present"
echo "   ✅ Configuration is valid"
echo "   ✅ Ports are checked"
echo ""
echo "🚀 Next steps:"
echo "   1. Run './start-mvp.sh' to start the MVP"
echo "   2. Add your ANTHROPIC_API_KEY to .env file"
echo "   3. Open http://localhost:3000 when services are ready"
echo ""
if [[ ! -f ".env" ]] || grep -q "ANTHROPIC_API_KEY=$" .env 2>/dev/null; then
    print_warning "⚠️  Remember to add your ANTHROPIC_API_KEY to .env for full functionality"
fi