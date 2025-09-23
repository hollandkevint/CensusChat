#!/bin/bash
# CensusChat Quick Start Script
# One-command setup for demo and development

set -e

echo "🚀 CensusChat Quick Start"
echo "========================="
echo ""

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

echo "✅ Docker is running"
echo ""

# Make setup script executable
chmod +x scripts/setup-demo.sh

# Run the demo setup
echo "🔧 Setting up CensusChat demo environment..."
echo ""

./scripts/setup-demo.sh

echo ""
echo "🎉 Setup Complete!"
echo ""
echo "📊 Access your applications:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3001"
echo "   Health:   http://localhost:3001/health"
echo ""
echo "🧪 Try these demo queries:"
echo "   1. 'Show me population data for Florida'"
echo "   2. 'What are the healthcare demographics for major counties?'"
echo "   3. 'Show me states with highest senior population'"
echo ""
echo "📁 Export feature: Click the Export button on any query result!"
echo ""
echo "🛠️  Management commands:"
echo "   View logs: docker-compose -f docker-compose.demo.yml logs -f"
echo "   Stop:      docker-compose -f docker-compose.demo.yml down"
echo "   Restart:   docker-compose -f docker-compose.demo.yml restart"
echo ""
echo "Happy demoing! 🎯"

