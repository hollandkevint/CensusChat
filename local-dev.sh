#!/bin/bash
# CensusChat Local Development Setup
# ===================================
# Runs backend and frontend locally with Docker only for databases
#
# Usage: ./local-dev.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 20+ from https://nodejs.org"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker Desktop from https://www.docker.com/get-started"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker Desktop and try again."
        exit 1
    fi
    
    NODE_VERSION=$(node --version)
    print_success "Node.js $NODE_VERSION installed"
    print_success "Docker is running"
}

# Stop full Docker Compose setup
stop_docker_services() {
    print_info "Stopping full Docker Compose setup..."
    
    if docker compose ps -q 2>/dev/null | grep -q .; then
        docker compose down
        print_success "Docker services stopped"
    else
        print_info "No Docker services running"
    fi
}

# Start only databases
start_databases() {
    print_info "Starting PostgreSQL and Redis..."
    
    docker compose up -d postgres redis
    
    # Wait for databases to be healthy
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
}

# Check if backend dependencies are installed
check_backend_deps() {
    print_info "Checking backend dependencies..."
    
    if [ ! -d "backend/node_modules" ]; then
        print_warning "Backend dependencies not installed. Installing now..."
        cd backend
        npm install
        cd ..
        print_success "Backend dependencies installed"
    else
        print_success "Backend dependencies already installed"
    fi
}

# Check if frontend dependencies are installed
check_frontend_deps() {
    print_info "Checking frontend dependencies..."
    
    if [ ! -d "frontend/node_modules" ]; then
        print_warning "Frontend dependencies not installed. Installing now..."
        cd frontend
        npm install
        cd ..
        print_success "Frontend dependencies installed"
    else
        print_success "Frontend dependencies already installed"
    fi
}

# Check for .env file
check_env_file() {
    print_info "Checking environment configuration..."
    
    if [ ! -f ".env" ]; then
        print_warning ".env file not found. Creating from .env.example..."
        cp .env.example .env
        
        # Generate JWT secret if openssl is available
        if command -v openssl &> /dev/null; then
            JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|g" .env
            else
                sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|g" .env
            fi
            print_success "Generated secure JWT_SECRET"
        fi
        
        print_success ".env file created"
    else
        print_success ".env file exists"
    fi
}

# Kill any processes on ports 3000 and 3001
kill_port_processes() {
    print_info "Checking for processes on ports 3000 and 3001..."
    
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_warning "Port 3000 is in use. Killing process..."
        lsof -ti :3000 | xargs kill -9 2>/dev/null || true
        print_success "Port 3000 freed"
    fi
    
    if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_warning "Port 3001 is in use. Killing process..."
        lsof -ti :3001 | xargs kill -9 2>/dev/null || true
        print_success "Port 3001 freed"
    fi
}

# Display instructions
show_instructions() {
    print_header "🎉 Setup Complete - Ready for Local Development!"
    
    echo ""
    echo -e "${GREEN}Databases are running in Docker:${NC}"
    echo "  🐘 PostgreSQL: localhost:5432"
    echo "  🔴 Redis:      localhost:6379"
    echo ""
    echo -e "${BLUE}Now run these commands in separate terminals:${NC}"
    echo ""
    echo -e "${YELLOW}Terminal 1 - Backend:${NC}"
    echo "  cd backend"
    echo "  npm run dev"
    echo ""
    echo -e "${YELLOW}Terminal 2 - Frontend:${NC}"
    echo "  cd frontend"
    echo "  npm run dev"
    echo ""
    echo -e "${BLUE}After starting both:${NC}"
    echo "  📱 Frontend: http://localhost:3000"
    echo "  🔧 Backend:  http://localhost:3001/api/v1/health"
    echo ""
    echo -e "${BLUE}To stop everything:${NC}"
    echo "  ${YELLOW}Ctrl+C${NC} in each terminal to stop backend/frontend"
    echo "  ${YELLOW}docker-compose down${NC} to stop databases"
    echo ""
    echo -e "${GREEN}💡 Pro Tip:${NC} Use a terminal multiplexer like tmux or split panes in your terminal"
    echo ""
}

# Main execution
main() {
    print_header "🚀 CensusChat Local Development Setup"
    
    check_prerequisites
    check_env_file
    stop_docker_services
    kill_port_processes
    start_databases
    check_backend_deps
    check_frontend_deps
    show_instructions
}

main
