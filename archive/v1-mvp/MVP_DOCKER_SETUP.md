# CensusChat MVP Docker Setup Guide

🚀 **Production-Ready MVP Deployment with Docker**

This guide provides a complete Docker setup for CensusChat MVP that's ready for production deployment with proper security, monitoring, and scalability considerations.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   PostgreSQL    │
│   (Next.js)     │◄──►│   (Express)     │◄──►│   Database      │
│   Port: 3000    │    │   Port: 3001    │    │   Port: 5432    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌─────────────────┐
                    │     Redis       │
                    │   Cache         │
                    │   Port: 6379    │
                    └─────────────────┘
```

## 🚀 Quick Start (2 minutes)

### 1. Prerequisites
- Docker & Docker Compose installed
- [Anthropic API Key](https://console.anthropic.com/) (required)
- [Census API Key](https://api.census.gov/data/key_signup.html) (optional)

### 2. One-Command Startup

```bash
# Make startup script executable and run
chmod +x start-mvp.sh
./start-mvp.sh
```

The script will:
- ✅ Check Docker is running
- ✅ Create .env from template if needed
- ✅ Build and start all services
- ✅ Verify service health
- ✅ Optionally initialize demo data

### 3. Manual Setup (Alternative)

```bash
# Copy environment template
cp .env.mvp .env

# Edit .env to add your API keys
nano .env  # Add ANTHROPIC_API_KEY

# Create directories
mkdir -p data logs

# Start MVP services
docker-compose -f docker-compose.mvp.yml up -d --build

# Initialize demo data (optional)
docker-compose -f docker-compose.mvp.yml --profile init up data-init
```

## 📋 Service Configuration

### Core Services

| Service | Container | Port | Purpose |
|---------|-----------|------|---------|
| Frontend | `censuschat-frontend-mvp` | 3000 | Next.js React application |
| Backend | `censuschat-backend-mvp` | 3001 | Express.js API server |
| PostgreSQL | `censuschat-postgres-mvp` | 5432 | User data & sessions |
| Redis | `censuschat-redis-mvp` | 6379 | Caching & sessions |

### Health Checks

All services include comprehensive health checks:

```bash
# Check all services
docker-compose -f docker-compose.mvp.yml ps

# Individual health checks
curl http://localhost:3001/health      # Backend health
curl http://localhost:3000             # Frontend health
curl http://localhost:3001/health/demo # Demo data status
```

## 🔧 Configuration

### Environment Variables

Key configurations in `.env`:

```bash
# Required for AI functionality
ANTHROPIC_API_KEY=your_key_here

# Optional for real Census data
CENSUS_API_KEY=your_census_key

# Database (auto-configured for Docker)
POSTGRES_USER=censuschat_user
POSTGRES_PASSWORD=mvp_password_2024
POSTGRES_DB=censuschat

# JWT Security (change for production!)
JWT_SECRET=mvp_jwt_secret_change_in_production_2024
```

### Production Security Checklist

Before production deployment:

- [ ] Change all default passwords
- [ ] Use strong JWT secrets (64+ characters)
- [ ] Enable SSL/TLS certificates
- [ ] Configure proper CORS origins
- [ ] Set up monitoring and logging
- [ ] Regular security updates

## 🗄️ Data Management

### Demo Data Initialization

```bash
# Initialize demo data
docker-compose -f docker-compose.mvp.yml --profile init up data-init

# Check demo status
curl http://localhost:3001/health/demo
```

### Real Census Data

With Census API key configured:

```bash
# Data will be loaded automatically on first API calls
# Monitor loading progress in logs
docker-compose -f docker-compose.mvp.yml logs -f backend
```

### Data Persistence

Data is persisted in Docker volumes:
- `postgres_data`: Database tables and user data
- `redis_data`: Cache and session data
- `./data`: DuckDB files and Census data
- `./logs`: Application logs

## 📊 Monitoring & Debugging

### View Logs

```bash
# All services
docker-compose -f docker-compose.mvp.yml logs -f

# Specific service
docker-compose -f docker-compose.mvp.yml logs -f backend
docker-compose -f docker-compose.mvp.yml logs -f frontend
```

### Service Management

```bash
# Start services
docker-compose -f docker-compose.mvp.yml up -d

# Stop services
docker-compose -f docker-compose.mvp.yml down

# Restart specific service
docker-compose -f docker-compose.mvp.yml restart backend

# Rebuild and restart
docker-compose -f docker-compose.mvp.yml up -d --build
```

### Performance Monitoring

```bash
# Container resource usage
docker stats

# Service health status
curl -s http://localhost:3001/health | jq

# Database connections
docker-compose -f docker-compose.mvp.yml exec postgres psql -U censuschat_user -d censuschat -c "SELECT count(*) FROM pg_stat_activity;"
```

## 🔒 Security Features

### Built-in Security

- ✅ Non-root containers for all services
- ✅ Health checks with proper timeouts
- ✅ Network isolation with custom bridge
- ✅ Secure secret management
- ✅ Input validation and sanitization
- ✅ CORS protection
- ✅ Rate limiting

### Container Security

```bash
# Verify non-root users
docker-compose -f docker-compose.mvp.yml exec backend whoami  # Should return 'nodejs'
docker-compose -f docker-compose.mvp.yml exec frontend whoami # Should return 'nextjs'
```

## 🌐 Production Deployment

### Cloud Deployment

This setup is ready for cloud deployment:

**AWS ECS/Fargate:**
```bash
# Use docker-compose.mvp.yml as base
# Add AWS-specific configurations
# Configure ALB for load balancing
```

**Google Cloud Run:**
```bash
# Build and push images
docker build -f backend/Dockerfile.mvp -t gcr.io/PROJECT/censuschat-backend .
docker build -f frontend/Dockerfile.mvp -t gcr.io/PROJECT/censuschat-frontend .
```

**Azure Container Instances:**
```bash
# Use Azure Container Registry
# Deploy with container groups
```

### Load Balancing

For production scale, add reverse proxy:

```yaml
# Add to docker-compose.mvp.yml
nginx:
  image: nginx:alpine
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - ./nginx.conf:/etc/nginx/nginx.conf
  depends_on:
    - frontend
    - backend
```

## 🧪 Testing

### Smoke Tests

```bash
# Basic functionality test
curl -X POST http://localhost:3001/api/v1/queries \
  -H "Content-Type: application/json" \
  -d '{"query": "Population of California"}'

# Frontend accessibility
curl -I http://localhost:3000

# Database connectivity
docker-compose -f docker-compose.mvp.yml exec postgres pg_isready
```

### Load Testing

```bash
# Install apache bench
sudo apt-get install apache2-utils

# Test backend performance
ab -n 1000 -c 10 http://localhost:3001/health

# Test frontend performance
ab -n 500 -c 5 http://localhost:3000/
```

## 📈 Scaling

### Horizontal Scaling

```yaml
# Scale backend instances
docker-compose -f docker-compose.mvp.yml up -d --scale backend=3

# Scale with load balancer
# Add nginx or traefik configuration
```

### Resource Optimization

```yaml
# Add resource limits to docker-compose.mvp.yml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
        reservations:
          memory: 256M
          cpus: '0.25'
```

## 🆘 Troubleshooting

### Common Issues

**Services won't start:**
```bash
# Check Docker daemon
docker info

# Check port conflicts
netstat -tulpn | grep :3000
netstat -tulpn | grep :3001
```

**Database connection issues:**
```bash
# Check PostgreSQL logs
docker-compose -f docker-compose.mvp.yml logs postgres

# Test database connection
docker-compose -f docker-compose.mvp.yml exec postgres psql -U censuschat_user -d censuschat -c "SELECT 1;"
```

**API key issues:**
```bash
# Verify environment variables
docker-compose -f docker-compose.mvp.yml exec backend printenv | grep API_KEY
```

### Reset Everything

```bash
# Complete reset (removes all data)
docker-compose -f docker-compose.mvp.yml down -v
docker system prune -a
./start-mvp.sh
```

## 📞 Support

### Health Check URLs

- Backend: http://localhost:3001/health
- Demo Status: http://localhost:3001/health/demo
- Export Service: http://localhost:3001/health/export
- Frontend: http://localhost:3000

### Log Locations

- Application logs: `./logs/`
- Container logs: `docker-compose logs`
- System logs: `/var/log/docker/`

---

**🎉 Success!** Your CensusChat MVP is now running in a production-ready Docker environment.

Visit http://localhost:3000 to start using your healthcare-focused demographic analysis platform!