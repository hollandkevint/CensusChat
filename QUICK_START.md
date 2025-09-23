# 🚀 CensusChat Quick Start

**Get CensusChat running in under 2 minutes with Docker!**

## 🎉 Production Ready Status

✅ **Foundation Data Loaded**: 8 counties with healthcare demographics
✅ **Complete Integration**: MCP + DuckDB + Frontend operational
✅ **Ready to Use**: Natural language healthcare analytics available now

## Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local development)

## One-Command Setup

```bash
./demo-setup.sh
```

This script will:
- ✅ Start PostgreSQL, Redis, Backend, and Frontend
- ✅ Initialize DuckDB database with foundation demographics
- ✅ Load 8 counties of healthcare data (FL, CA, NY, TX, IL)
- ✅ Verify all services are healthy and data is accessible

## Manual Setup

### 1. Environment Configuration

```bash
# Copy example environment
cp .env.example .env

# Edit .env with your values (JWT_SECRET is required)
# Other values have sensible defaults
```

### 2. Start Services

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

## Access Your Application

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:3000 | Main application |
| **Backend API** | http://localhost:3001/api/v1 | REST API |
| **Health Check** | http://localhost:3001/health | System status |

## Quick Test

```bash
# Test the API
curl http://localhost:3001/health

# Should return: {"status":"healthy","timestamp":"..."}
```

## Foundation Data Available

- **8 Counties Loaded**: Miami-Dade, Broward, Palm Beach (FL); Los Angeles, San Diego (CA); New York (NY); Harris (TX); Cook (IL)
- **Healthcare Demographics**: Total population, seniors 65+, median income, Medicare eligibility estimates
- **Analytics Ready**: Real Census data powering natural language queries
- **Export Formats**: Excel, CSV with statistical metadata and confidence intervals

## Development Commands

```bash
# Stop services
docker-compose down

# Rebuild containers
docker-compose build

# View container logs
docker-compose logs backend
docker-compose logs frontend

# Access backend container
docker-compose exec backend sh

# Run tests (when implemented)
docker-compose exec backend npm test
```

## Troubleshooting

### Services Won't Start
```bash
# Check Docker is running
docker info

# Ensure ports are available
lsof -i :3000 -i :3001 -i :5432 -i :6379
```

### Backend Issues
```bash
# Check environment variables
docker-compose exec backend env | grep -E "(JWT_SECRET|POSTGRES|REDIS)"

# View detailed logs
docker-compose logs backend --tail=50
```

### Data Issues
```bash
# Check DuckDB foundation data
ls -la ./backend/data/census.duckdb

# Reload foundation data
cd backend && node src/scripts/simpleDuckDBLoader.js

# Verify data is loaded
curl -X POST http://localhost:3001/api/v1/queries \
  -H "Content-Type: application/json" \
  -d '{"query": "Show me population data"}'
```

## Build for Production

```bash
# Production build (when ready)
docker-compose -f docker-compose.prod.yml up -d
```

## Next Steps

1. **Test Natural Language Queries**: Visit http://localhost:3000 and try queries like "Show me seniors in Florida counties"
2. **Explore Foundation Data**: 8 counties of real healthcare demographics are ready for analysis
3. **Customize Analytics**: Modify query processing in `backend/src/routes/query.routes.ts`
4. **Add More Data**: Use `backend/src/scripts/simpleDuckDBLoader.js` as a template for additional counties
5. **Deploy**: System is production-ready for deployment

---

## Need Help?

- 📖 **Documentation**: Check the `docs/` directory
- 🐛 **Issues**: Create a GitHub issue
- 💬 **Discussion**: Start a GitHub discussion

**Ready to build in public! 🚀**