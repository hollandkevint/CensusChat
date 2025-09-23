# CensusChat Demo Setup Guide

## 🚀 Quick Start

This guide will help you set up CensusChat with Docker containers for localhost deployment and demoing, including an active DuckDB file with sample healthcare demographics data.

### Prerequisites

- Docker and Docker Compose installed
- 4GB+ available RAM
- 2GB+ available disk space

### One-Command Setup

```bash
# Clone and setup
git clone <repository-url>
cd CensusChat
chmod +x scripts/setup-demo.sh
./scripts/setup-demo.sh
```

## 📋 What Gets Set Up

### Docker Services
- **PostgreSQL** (port 5432) - User data and sessions
- **Redis** (port 6379) - Caching and rate limiting
- **Backend API** (port 3001) - Node.js/TypeScript API
- **Frontend** (port 3000) - Next.js React application
- **DuckDB** - Embedded analytics database with demo data

### Demo Data Included
- **10 US States** with population and income data
- **10 Major Counties** with healthcare metrics
- **Healthcare Demographics** including:
  - Uninsured rates
  - Medicare/Medicaid eligibility
  - Primary care physician counts
  - Senior population data

## 🎯 Demo Scenarios

### 1. Basic Population Query
```
Query: "Show me population data for Florida"
Expected: State-level demographics with export option
```

### 2. Healthcare Demographics
```
Query: "What are the healthcare demographics for major counties?"
Expected: County-level healthcare metrics with Excel export
```

### 3. Senior Population Analysis
```
Query: "Show me states with highest senior population"
Expected: Ranked list with senior percentages and income data
```

### 4. Export Functionality Demo
1. Run any query that returns data
2. Click the "Export" button
3. Choose Excel format
4. Watch progress indicator
5. Download professional Excel file with multiple worksheets

## 🔧 Manual Setup (Alternative)

If you prefer manual setup:

### 1. Environment Setup
```bash
# Copy environment template
cp env.example .env

# Edit .env with your preferences (optional)
nano .env
```

### 2. Start Services
```bash
# Start all services
docker-compose -f docker-compose.demo.yml up -d

# View logs
docker-compose -f docker-compose.demo.yml logs -f

# Check status
docker-compose -f docker-compose.demo.yml ps
```

### 3. Initialize Demo Data
```bash
# Run demo data seeding
docker exec censuschat-backend-demo npm run seed:demo

# Or manually seed
docker exec censuschat-backend-demo node dist/scripts/seedDemoData.js
```

## 📊 Demo Data Structure

### States Data
- Florida, California, Texas, New York, Pennsylvania
- Illinois, Ohio, Georgia, North Carolina, Michigan
- Population, median income, senior population (65+)

### Counties Data
- Major metropolitan areas (Miami-Dade, Los Angeles, Harris, etc.)
- Population and income metrics
- Healthcare infrastructure data

### Healthcare Metrics
- Uninsured rates by geography
- Medicare/Medicaid eligibility counts
- Primary care physician availability
- Senior population demographics

## 🧪 Testing the Export Feature

### Excel Export Test
1. **Query**: "Show me population data for Florida"
2. **Export**: Click Export → Excel (.xlsx)
3. **Progress**: Watch real-time progress indicator
4. **Download**: Professional Excel file with:
   - Data worksheet with formatted results
   - Metadata worksheet with query details
   - Data dictionary with variable definitions

### CSV Export Test
1. **Query**: "What are the healthcare demographics for major counties?"
2. **Export**: Click Export → CSV (.csv)
3. **Download**: Simple CSV file for data analysis tools

## 🔍 Health Checks

### Service Health
```bash
# Check all services
curl http://localhost:3001/health

# Check demo data status
curl http://localhost:3001/health/demo

# Check export service
curl http://localhost:3001/health/export
```

### Database Connections
```bash
# PostgreSQL
docker exec censuschat-postgres-demo pg_isready

# Redis
docker exec censuschat-redis-demo redis-cli ping

# DuckDB (via backend)
docker exec censuschat-backend-demo ls -la /app/data/
```

## 🛠️ Management Commands

### View Logs
```bash
# All services
docker-compose -f docker-compose.demo.yml logs -f

# Specific service
docker-compose -f docker-compose.demo.yml logs -f backend
docker-compose -f docker-compose.demo.yml logs -f frontend
```

### Restart Services
```bash
# Restart all
docker-compose -f docker-compose.demo.yml restart

# Restart specific service
docker-compose -f docker-compose.demo.yml restart backend
```

### Stop Services
```bash
# Stop all services
docker-compose -f docker-compose.demo.yml down

# Stop and remove volumes (clean slate)
docker-compose -f docker-compose.demo.yml down -v
```

### Update Demo Data
```bash
# Re-seed demo data
docker exec censuschat-backend-demo node dist/scripts/seedDemoData.js

# Rebuild containers
docker-compose -f docker-compose.demo.yml build --no-cache
docker-compose -f docker-compose.demo.yml up -d
```

## 📁 File Locations

### Application Files
- **Frontend**: `http://localhost:3000`
- **Backend API**: `http://localhost:3001`
- **API Docs**: `http://localhost:3001/api/v1`

### Data Files
- **DuckDB**: `./data/census.duckdb`
- **Demo Data**: `./data/demo-data.json`
- **Sample Queries**: `./data/sample-queries.json`
- **Export Files**: `./temp/exports/`

### Docker Files
- **Compose**: `docker-compose.demo.yml`
- **Setup Script**: `scripts/setup-demo.sh`
- **Environment**: `.env` (created from `env.example`)

## 🎨 Demo Customization

### Add More States
Edit `backend/src/scripts/seedDemoData.ts` and add more states to the `demoData.states` array.

### Add More Counties
Add counties to the `demoData.counties` array with corresponding healthcare metrics.

### Custom Queries
Add sample queries to the `sampleQueries` array in the seeding script.

### Export Templates
Modify `backend/src/utils/excelFormatting.ts` to customize Excel formatting and worksheets.

## 🚨 Troubleshooting

### Common Issues

#### Services Won't Start
```bash
# Check Docker is running
docker info

# Check port conflicts
netstat -tulpn | grep :3000
netstat -tulpn | grep :3001
netstat -tulpn | grep :5432
netstat -tulpn | grep :6379
```

#### Export Feature Not Working
```bash
# Check export service health
curl http://localhost:3001/health/export

# Check temp directory permissions
docker exec censuschat-backend-demo ls -la /app/temp/

# Check backend logs
docker-compose -f docker-compose.demo.yml logs backend
```

#### Demo Data Missing
```bash
# Re-run demo seeding
docker exec censuschat-backend-demo node dist/scripts/seedDemoData.js

# Check demo status
curl http://localhost:3001/health/demo
```

#### Frontend Not Loading
```bash
# Check frontend logs
docker-compose -f docker-compose.demo.yml logs frontend

# Restart frontend
docker-compose -f docker-compose.demo.yml restart frontend
```

### Performance Issues

#### Slow Queries
- Check Redis cache: `docker exec censuschat-redis-demo redis-cli info memory`
- Monitor backend logs for query performance
- Check DuckDB file size: `ls -lh ./data/census.duckdb`

#### Memory Issues
- Increase Docker memory allocation
- Check container memory usage: `docker stats`
- Restart services if needed

## 🎉 Demo Success Criteria

### ✅ Basic Functionality
- [ ] Frontend loads at http://localhost:3000
- [ ] Backend API responds at http://localhost:3001
- [ ] Health checks pass
- [ ] Demo data is loaded

### ✅ Query Functionality
- [ ] Can ask "Show me population data for Florida"
- [ ] Results display in formatted table
- [ ] Metadata shows query time and data source

### ✅ Export Functionality
- [ ] Export button appears on query results
- [ ] Excel export works with progress indicator
- [ ] CSV export works as fallback
- [ ] Downloaded files open correctly

### ✅ Professional Features
- [ ] Excel files have multiple worksheets
- [ ] Data is properly formatted
- [ ] Metadata includes query details
- [ ] Progress tracking works for large exports

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review Docker logs: `docker-compose -f docker-compose.demo.yml logs`
3. Verify all services are healthy: `curl http://localhost:3001/health`
4. Try a clean restart: `docker-compose -f docker-compose.demo.yml down -v && ./scripts/setup-demo.sh`

## 🎯 Next Steps

After successful demo setup:

1. **Explore the UI** - Try different healthcare demographic queries
2. **Test Export Features** - Export data in both Excel and CSV formats
3. **Review the Code** - Examine the implementation in `backend/src/services/excelExportService.ts`
4. **Customize Data** - Add your own demo data or modify existing datasets
5. **Extend Features** - Build upon the export functionality for your use case

Happy demoing! 🚀

