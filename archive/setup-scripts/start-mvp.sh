#!/bin/bash

# CensusChat MVP Startup Script
# =============================

set -e

echo "🚀 CensusChat MVP Docker Setup"
echo "=============================="

# Colors for output
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

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

print_success "Docker is running"

# Check if .env file exists, if not create from MVP template
if [ ! -f .env ]; then
    print_warning ".env file not found. Creating from MVP template..."
    cp .env.mvp .env
    print_success "Created .env file from MVP template"
    echo ""
    print_warning "⚠️  IMPORTANT: Edit .env file to add your API keys:"
    echo "   - ANTHROPIC_API_KEY (required for AI functionality)"
    echo "   - CENSUS_API_KEY (optional, for real Census data)"
    echo ""
    read -p "Press Enter to continue or Ctrl+C to exit and edit .env first..."
fi

# Create data and logs directories
print_status "Creating necessary directories..."
mkdir -p data logs
print_success "Directories created"

# Build and start services
print_status "Building and starting CensusChat MVP services..."
echo ""

# Stop any existing containers
docker-compose -f docker-compose.mvp.yml down 2>/dev/null || true

# Build and start services
docker-compose -f docker-compose.mvp.yml up -d --build

# Check if services are starting
print_status "Waiting for services to start..."
sleep 10

# Check service health
print_status "Checking service health..."

# Wait for backend to be healthy
echo -n "Waiting for backend to be ready"
for i in {1..30}; do
    if curl -f http://localhost:3001/health > /dev/null 2>&1; then
        echo ""
        print_success "Backend is healthy"
        break
    fi
    echo -n "."
    sleep 2
done

# Wait for frontend to be ready
echo -n "Waiting for frontend to be ready"
for i in {1..30}; do
    if curl -f http://localhost:3000 > /dev/null 2>&1; then
        echo ""
        print_success "Frontend is healthy"
        break
    fi
    echo -n "."
    sleep 2
done

# Initialize demo data if requested
echo ""
read -p "Initialize demo data? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Initializing demo data..."
    docker-compose -f docker-compose.mvp.yml --profile init up data-init
    print_success "Demo data initialized"
fi

echo ""
print_success "🎉 CensusChat MVP is now running!"
echo ""
echo "📋 Service URLs:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:3001"
echo "   Health Check: http://localhost:3001/health"
echo ""
echo "🔧 Management:"
echo "   View logs: docker-compose -f docker-compose.mvp.yml logs -f"
echo "   Stop services: docker-compose -f docker-compose.mvp.yml down"
echo "   Restart: docker-compose -f docker-compose.mvp.yml restart"
echo ""
echo "💡 Next Steps:"
echo "   1. Open http://localhost:3000 in your browser"
echo "   2. Try the interactive chat with sample queries"
echo "   3. Check that API keys are configured in .env"
echo "   4. Review logs if there are any issues"
echo ""
print_warning "Note: Edit .env file to add your ANTHROPIC_API_KEY for full AI functionality"