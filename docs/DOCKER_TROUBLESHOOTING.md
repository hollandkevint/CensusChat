# Docker Setup Troubleshooting

## Current Status (October 1, 2025)

**Issue**: Backend container crashes during startup in Docker Compose
**Root Causes Identified**:
1. TypeScript compilation errors (173 errors) causing ts-node failures
2. Redis connection blocking module initialization
3. Module-level imports attempting connections before server starts

**Fixed Issues**:
- ✅ Redis `retryDelayOnFailover` deprecated option removed
- ✅ FallbackService duplicate export removed
- ✅ Production data mounted correctly (`./backend/data` → `/app/data`)
- ✅ Redis connection now has retry strategy and offline queue disabled

**Remaining Issues**:
- TypeScript strict mode errors in data-loading modules
- Module initialization order causing Redis connection hang
- 173 TypeScript errors preventing compilation

## Workaround: Local Development

**Use local development instead of Docker**:

```bash
# Terminal 1 - Backend (port 3001)
cd backend
npm run dev

# Terminal 2 - Frontend (port 3000)
cd frontend
npm run dev
```

**Benefits**:
- ✅ Production data (3,144 counties) already loaded
- ✅ No Docker complexity
- ✅ Faster development iteration
- ✅ Full access to debugging tools

## Docker Fix Roadmap

To fully fix Docker setup:

### 1. Fix TypeScript Errors (Estimated: 2-3 hours)

**Priority Fixes**:
- [ ] Data loading module type definitions
- [ ] MCP service interface consistency
- [ ] Remove unused variable declarations
- [ ] Fix union type mismatches

**Run to see errors**:
```bash
docker exec censuschat-backend npx tsc --noEmit 2>&1 | grep "error TS"
```

### 2. Fix Redis Connection Blocking (Estimated: 1 hour)

**Current Issue**: Redis client connects at module load time, blocking startup

**Solution Options**:

**Option A**: Lazy initialization
```typescript
// cacheService.ts
let redis: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redis) {
    redis = new Redis({ /* config */ });
  }
  return redis;
}
```

**Option B**: Async initialization
```typescript
// index.ts
app.listen(PORT, async () => {
  await initializeServices(); // Connect Redis here
});
```

**Option C**: Make Redis completely optional
```typescript
// Check Redis availability before every operation
export async function getCacheData(key: string) {
  if (!cacheAvailable) return null;
  try {
    return await redis.get(key);
  } catch (error) {
    return null; // Graceful degradation
  }
}
```

### 3. Update nodemon Configuration (Estimated: 15 minutes)

Add to `nodemon.json`:
```json
{
  "watch": ["src"],
  "ext": "ts",
  "exec": "TS_NODE_TRANSPILE_ONLY=true ts-node -r tsconfig-paths/register src/index.ts",
  "ignore": ["src/**/*.test.ts"],
  "env": {
    "TS_NODE_TRANSPILE_ONLY": "true",
    "TS_NODE_COMPILER_OPTIONS": "{\"strict\": false}"
  }
}
```

### 4. Alternative: Build First, Then Run (Recommended)

Instead of using ts-node in Docker, build the TypeScript first:

**Update Dockerfile**:
```dockerfile
# backend/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
CMD ["node", "dist/index.js"]
```

**Update docker-compose.yml**:
```yaml
backend:
  build:
    context: ./backend
    target: runtime  # Use runtime stage
  command: node dist/index.js  # Run compiled code
```

**Benefits**:
- No TypeScript compilation in container
- Faster startup
- Production-ready approach
- Catches errors at build time

## Railway Deployment Note

**Important**: These Docker issues don't affect Railway deployment because:

1. **Railway builds from source**: Uses its own build process
2. **Different environment**: Fresh dependencies and configuration
3. **Production builds**: Compiles TypeScript before running
4. **Managed services**: PostgreSQL and Redis are managed separately

The Railway deployment guide (`docs/guides/RAILWAY_DEPLOYMENT.md`) will work regardless of local Docker issues.

## Quick Test: Is Docker Worth Fixing?

**Time Investment**:
- Fix TypeScript errors: 2-3 hours
- Fix Redis blocking: 1 hour
- Test and verify: 30 minutes
- **Total**: 3.5-4.5 hours

**Alternative**:
- Use local development: Works now (0 hours)
- Deploy to Railway: 15-20 minutes

**Recommendation**: Use local development for testing, then deploy directly to Railway for external access. Fix Docker later if needed for team development or CI/CD.

## Current Working Setup

**✅ Local Development (Recommended)**:
```bash
# Postgres & Redis via Docker
docker-compose up postgres redis -d

# Backend locally
cd backend && npm run dev  # Port 3001

# Frontend locally
cd frontend && npm run dev  # Port 3000
```

**Data Status**:
- ✅ 3,144 counties loaded in `backend/data/census.duckdb`
- ✅ 1.5MB production Census Bureau data
- ✅ All 51 states (50 + DC)

## Support

If you need Docker working for specific reasons:
1. Follow the fix roadmap above
2. Consider using Railway for production
3. Use local development for immediate work

**Last Updated**: October 1, 2025
