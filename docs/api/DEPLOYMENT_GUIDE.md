# FDB-MCP Deployment Guide

**Production Deployment Guide for Fast Database - Model Context Protocol Framework**

## Table of Contents

1. [Deployment Overview](#deployment-overview)
2. [Prerequisites](#prerequisites)
3. [Environment Setup](#environment-setup)
4. [Production Configuration](#production-configuration)
5. [Container Deployment](#container-deployment)
6. [Monitoring & Observability](#monitoring--observability)
7. [Security Considerations](#security-considerations)
8. [Performance Optimization](#performance-optimization)
9. [Disaster Recovery](#disaster-recovery)
10. [Maintenance & Updates](#maintenance--updates)

## Deployment Overview

The FDB-MCP framework requires careful production configuration to ensure sub-2 second response times, high availability, and secure access to public datasets. This guide covers deployment for healthcare, education, transportation, and environmental analytics modules.

### Architecture Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer (nginx)                     │
├─────────────────────────────────────────────────────────────┤
│  Node.js App   │  Node.js App   │  Node.js App   │ Health   │
│   Instance 1   │   Instance 2   │   Instance 3   │ Monitor  │
├─────────────────────────────────────────────────────────────┤
│                    Redis Cluster                             │
│              (Query Cache & Session Store)                   │
├─────────────────────────────────────────────────────────────┤
│                   DuckDB Database                            │
│               (Optimized Connection Pool)                    │
├─────────────────────────────────────────────────────────────┤
│  External APIs │  External APIs │  External APIs  │  MCP    │
│  Census Bureau │      CMS       │      EPA        │ Server  │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

### System Requirements

```yaml
# Minimum Production Requirements
CPU: 8 cores (16 recommended)
RAM: 16GB (32GB recommended)
Storage: 500GB SSD (1TB recommended)
Network: 1Gbps
OS: Ubuntu 20.04 LTS or later

# Software Dependencies
Node.js: 18.x LTS
TypeScript: 5.x
DuckDB: 0.9.x or later
Redis: 7.x
nginx: 1.20+
Docker: 24.x (if using containers)
```

### API Access Requirements

```bash
# Required API Keys (set as environment variables)
CENSUS_API_KEY=your_census_api_key
CMS_API_KEY=your_cms_api_key
EPA_API_KEY=your_epa_api_key
DOE_API_KEY=your_education_api_key
DOT_API_KEY=your_transportation_api_key

# MCP Server Configuration
MCP_SERVER_URL=https://mcp-server.your-domain.com
MCP_CLIENT_ID=your_mcp_client_id
MCP_CLIENT_SECRET=your_mcp_client_secret
```

## Environment Setup

### 1. Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install DuckDB
wget https://github.com/duckdb/duckdb/releases/download/v0.9.0/duckdb_cli-linux-amd64.zip
unzip duckdb_cli-linux-amd64.zip
sudo mv duckdb /usr/local/bin/

# Install Redis
sudo apt install redis-server -y
sudo systemctl enable redis-server

# Install nginx
sudo apt install nginx -y
sudo systemctl enable nginx
```

### 2. Application Setup

```bash
# Clone repository
git clone https://github.com/your-org/census-chat.git
cd census-chat

# Install dependencies
npm ci --production

# Build application
npm run build

# Create production directories
sudo mkdir -p /var/log/fdb-mcp
sudo mkdir -p /opt/fdb-mcp/data
sudo chown -R $(whoami):$(whoami) /var/log/fdb-mcp /opt/fdb-mcp
```

### 3. Database Initialization

```bash
# Create DuckDB database directory
mkdir -p /opt/fdb-mcp/data/duckdb

# Initialize healthcare analytics database
duckdb /opt/fdb-mcp/data/duckdb/healthcare.db < ./scripts/init-healthcare-db.sql

# Initialize other domain databases
duckdb /opt/fdb-mcp/data/duckdb/education.db < ./scripts/init-education-db.sql
duckdb /opt/fdb-mcp/data/duckdb/transportation.db < ./scripts/init-transportation-db.sql
duckdb /opt/fdb-mcp/data/duckdb/environment.db < ./scripts/init-environment-db.sql
```

## Production Configuration

### 1. Environment Variables

Create `/opt/fdb-mcp/.env.production`:

```bash
# Application Configuration
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Database Configuration
DUCKDB_PATH=/opt/fdb-mcp/data/duckdb
DUCKDB_MEMORY_LIMIT=8GB
DUCKDB_THREADS=8
DUCKDB_MAX_CONNECTIONS=25
DUCKDB_MIN_CONNECTIONS=5

# Cache Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
CACHE_TTL=300000
CACHE_MAX_SIZE=5000

# Performance Configuration
QUERY_TIMEOUT=10000
MAX_CONCURRENT_QUERIES=20
PERFORMANCE_MONITORING_INTERVAL=10000

# Security Configuration
CORS_ORIGINS=https://your-frontend-domain.com
API_RATE_LIMIT=100
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_32_byte_encryption_key

# External API Configuration
CENSUS_API_BASE_URL=https://api.census.gov/data
CMS_API_BASE_URL=https://data.cms.gov/api
EPA_API_BASE_URL=https://aqs.epa.gov/data/api
REQUEST_TIMEOUT=30000
RETRY_ATTEMPTS=3

# MCP Configuration
MCP_SERVER_URL=https://mcp-server.your-domain.com
MCP_TOOLS_NAMESPACE=fdb_mcp
MCP_AUTH_TIMEOUT=30000

# Monitoring Configuration
METRICS_ENABLED=true
HEALTH_CHECK_INTERVAL=30000
ALERT_WEBHOOK_URL=https://your-monitoring-service.com/webhook
```

### 2. Application Configuration

Create `config/production.json`:

```json
{
  "server": {
    "port": 3000,
    "host": "0.0.0.0",
    "requestTimeout": 30000,
    "bodyLimit": "10mb"
  },
  "database": {
    "duckdb": {
      "path": "/opt/fdb-mcp/data/duckdb",
      "poolConfig": {
        "minConnections": 5,
        "maxConnections": 25,
        "connectionTimeout": 30000,
        "memoryLimit": "8GB",
        "threads": 8
      }
    }
  },
  "cache": {
    "redis": {
      "host": "localhost",
      "port": 6379,
      "retryDelayOnFailover": 100,
      "maxRetriesPerRequest": 3,
      "lazyConnect": true
    },
    "query": {
      "maxSize": 5000,
      "ttl": 300000,
      "staleWhileRevalidate": 60000,
      "compressionThreshold": 100000
    }
  },
  "performance": {
    "thresholds": {
      "maxExecutionTime": 2000,
      "maxCacheMissRate": 0.2,
      "minCacheHitRate": 0.8,
      "maxConcurrentQueries": 20,
      "alertCooldown": 300000
    },
    "monitoring": {
      "enabled": true,
      "interval": 10000,
      "metricsRetention": 86400000
    }
  },
  "security": {
    "cors": {
      "origins": ["https://your-frontend-domain.com"],
      "credentials": true
    },
    "rateLimit": {
      "windowMs": 900000,
      "max": 100,
      "standardHeaders": true
    },
    "authentication": {
      "jwtSecret": "your_jwt_secret",
      "tokenExpiration": "24h"
    }
  },
  "logging": {
    "level": "info",
    "format": "json",
    "transports": [
      {
        "type": "file",
        "filename": "/var/log/fdb-mcp/application.log",
        "maxSize": "10m",
        "maxFiles": 5
      },
      {
        "type": "file",
        "filename": "/var/log/fdb-mcp/error.log",
        "level": "error",
        "maxSize": "10m",
        "maxFiles": 5
      }
    ]
  }
}
```

### 3. nginx Configuration

Create `/etc/nginx/sites-available/fdb-mcp`:

```nginx
upstream fdb_mcp_backend {
    least_conn;
    server 127.0.0.1:3000 weight=1 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3001 weight=1 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3002 weight=1 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name your-api-domain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-api-domain.com;

    # SSL Configuration
    ssl_certificate /path/to/ssl/certificate.pem;
    ssl_certificate_key /path/to/ssl/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        application/json
        application/javascript
        application/x-javascript
        text/css
        text/javascript
        text/plain
        text/xml;

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    # Health Check Endpoint
    location /health {
        access_log off;
        proxy_pass http://fdb_mcp_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_send_timeout 10s;
        proxy_read_timeout 10s;
    }

    # Main API Routes
    location / {
        proxy_pass http://fdb_mcp_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeout Configuration
        proxy_connect_timeout 30s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Buffer Configuration
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
    }

    # MCP-specific routes
    location /mcp/ {
        proxy_pass http://fdb_mcp_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Extended timeouts for complex analytics
        proxy_connect_timeout 30s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    # Static files (if any)
    location /static/ {
        root /opt/fdb-mcp/public;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Access and Error Logs
    access_log /var/log/nginx/fdb-mcp-access.log;
    error_log /var/log/nginx/fdb-mcp-error.log warn;
}
```

Enable the configuration:
```bash
sudo ln -s /etc/nginx/sites-available/fdb-mcp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Container Deployment

### 1. Dockerfile

Create `Dockerfile`:

```dockerfile
# Multi-stage build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/
COPY scripts/ ./scripts/

# Build application
RUN npm run build

# Production image
FROM node:18-alpine AS production

# Install system dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    unzip

# Install DuckDB
RUN wget -O /tmp/duckdb.zip https://github.com/duckdb/duckdb/releases/download/v0.9.0/duckdb_cli-linux-amd64.zip \
    && unzip /tmp/duckdb.zip -d /tmp/ \
    && mv /tmp/duckdb /usr/local/bin/ \
    && chmod +x /usr/local/bin/duckdb \
    && rm /tmp/duckdb.zip

# Create app user
RUN addgroup -g 1001 -S fdbmcp \
    && adduser -S fdbmcp -u 1001

# Create application directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=fdbmcp:fdbmcp /app/node_modules ./node_modules
COPY --from=builder --chown=fdbmcp:fdbmcp /app/dist ./dist
COPY --from=builder --chown=fdbmcp:fdbmcp /app/scripts ./scripts
COPY --chown=fdbmcp:fdbmcp package*.json ./

# Create data directory
RUN mkdir -p /app/data && chown -R fdbmcp:fdbmcp /app/data

# Switch to non-root user
USER fdbmcp

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Expose port
EXPOSE 3000

# Use dumb-init to handle signals
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/index.js"]
```

### 2. Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  fdb-mcp-app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
      - "3001:3000"
      - "3002:3000"
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 4G
          cpus: '2.0'
        reservations:
          memory: 2G
          cpus: '1.0'
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
      - DUCKDB_PATH=/app/data/duckdb
    env_file:
      - .env.production
    volumes:
      - fdb_mcp_data:/app/data
      - fdb_mcp_logs:/app/logs
    depends_on:
      - redis
    networks:
      - fdb_mcp_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
      - ./config/redis.conf:/usr/local/etc/redis/redis.conf
    networks:
      - fdb_mcp_network
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./config/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
      - nginx_logs:/var/log/nginx
    depends_on:
      - fdb-mcp-app
    networks:
      - fdb_mcp_network
    restart: unless-stopped

volumes:
  fdb_mcp_data:
  fdb_mcp_logs:
  redis_data:
  nginx_logs:

networks:
  fdb_mcp_network:
    driver: bridge
```

### 3. Deployment Scripts

Create `scripts/deploy.sh`:

```bash
#!/bin/bash

set -e

echo "🚀 Starting FDB-MCP production deployment..."

# Configuration
COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_DIR="/opt/backups/fdb-mcp"
DEPLOY_DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup current data
echo "📦 Creating backup..."
docker-compose -f $COMPOSE_FILE exec fdb-mcp-app tar -czf /tmp/data-backup-$DEPLOY_DATE.tar.gz /app/data
docker cp $(docker-compose -f $COMPOSE_FILE ps -q fdb-mcp-app | head -1):/tmp/data-backup-$DEPLOY_DATE.tar.gz $BACKUP_DIR/

# Pull latest images
echo "📥 Pulling latest images..."
docker-compose -f $COMPOSE_FILE pull

# Deploy with rolling update
echo "🔄 Performing rolling deployment..."
docker-compose -f $COMPOSE_FILE up -d --no-deps --scale fdb-mcp-app=3 --remove-orphans

# Health check
echo "🏥 Performing health check..."
sleep 30

for i in {1..10}; do
    if curl -f http://localhost/health > /dev/null 2>&1; then
        echo "✅ Health check passed"
        break
    else
        echo "⏳ Waiting for application to be ready... ($i/10)"
        sleep 10
    fi

    if [ $i -eq 10 ]; then
        echo "❌ Health check failed after 100 seconds"
        echo "🔄 Rolling back to previous version..."
        docker-compose -f $COMPOSE_FILE down
        # Restore from backup would go here
        exit 1
    fi
done

# Clean up old images
echo "🧹 Cleaning up old images..."
docker image prune -f

echo "✅ Deployment completed successfully!"
echo "📊 Deployment summary:"
echo "   - Deploy time: $(date)"
echo "   - Backup created: $BACKUP_DIR/data-backup-$DEPLOY_DATE.tar.gz"
echo "   - Application URL: https://your-api-domain.com"
echo "   - Health check: https://your-api-domain.com/health"
```

Make it executable:
```bash
chmod +x scripts/deploy.sh
```

## Monitoring & Observability

### 1. Application Metrics

Create `config/metrics.json`:

```json
{
  "metrics": {
    "enabled": true,
    "interval": 10000,
    "collectors": [
      {
        "name": "query_performance",
        "type": "histogram",
        "description": "Query execution time distribution",
        "buckets": [0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
      },
      {
        "name": "cache_hit_rate",
        "type": "gauge",
        "description": "Cache hit rate percentage"
      },
      {
        "name": "active_connections",
        "type": "gauge",
        "description": "Active database connections"
      },
      {
        "name": "api_requests_total",
        "type": "counter",
        "description": "Total API requests by domain and status"
      },
      {
        "name": "mcp_tool_usage",
        "type": "counter",
        "description": "MCP tool usage by tool name"
      }
    ]
  },
  "alerts": [
    {
      "name": "high_response_time",
      "condition": "avg_response_time > 2000",
      "severity": "warning",
      "webhook": "https://your-monitoring-service.com/webhook"
    },
    {
      "name": "low_cache_hit_rate",
      "condition": "cache_hit_rate < 0.7",
      "severity": "warning",
      "webhook": "https://your-monitoring-service.com/webhook"
    },
    {
      "name": "high_error_rate",
      "condition": "error_rate > 0.05",
      "severity": "critical",
      "webhook": "https://your-monitoring-service.com/webhook"
    }
  ]
}
```

### 2. Health Check Endpoint

```typescript
// src/routes/health.ts
export const healthCheckRouter = Router();

healthCheckRouter.get('/health', async (req, res) => {
  const startTime = Date.now();

  try {
    // Check database connectivity
    const pool = getDuckDBPool();
    const dbHealthy = await pool.healthCheck();

    // Check cache connectivity
    const redis = getRedisClient();
    const cacheHealthy = await redis.ping() === 'PONG';

    // Check external API connectivity
    const apiHealthChecks = await Promise.allSettled([
      checkCensusAPIHealth(),
      checkCMSAPIHealth(),
      checkEPAAPIHealth()
    ]);

    const externalAPIsHealthy = apiHealthChecks.filter(
      result => result.status === 'fulfilled'
    ).length >= 2; // At least 2/3 APIs should be healthy

    // Performance metrics
    const performanceMonitor = getPerformanceMonitor();
    const metrics = performanceMonitor.getPerformanceMetrics();

    const responseTime = Date.now() - startTime;

    const health = {
      status: dbHealthy && cacheHealthy && externalAPIsHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime,
      checks: {
        database: dbHealthy ? 'healthy' : 'unhealthy',
        cache: cacheHealthy ? 'healthy' : 'unhealthy',
        externalAPIs: externalAPIsHealthy ? 'healthy' : 'degraded'
      },
      performance: {
        avgResponseTime: metrics.avgExecutionTime,
        cacheHitRate: metrics.cacheStats.hitRatio,
        sub2sCompliance: metrics.sub2sCompliance
      },
      version: process.env.npm_package_version || '1.0.0'
    };

    res.status(health.status === 'healthy' ? 200 : 503).json(health);

  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    });
  }
});
```

### 3. Logging Configuration

```typescript
// src/utils/logger.ts
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'fdb-mcp' },
  transports: [
    new winston.transports.File({
      filename: '/var/log/fdb-mcp/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: '/var/log/fdb-mcp/application.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

export { logger };
```

## Security Considerations

### 1. API Security

```typescript
// Security middleware configuration
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.census.gov", "https://data.cms.gov"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || false,
  credentials: true,
  optionsSuccessStatus: 200
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', apiLimiter);

// Stricter limits for MCP endpoints
const mcpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'MCP endpoint rate limit exceeded'
});

app.use('/mcp/', mcpLimiter);
```

### 2. Data Encryption

```typescript
// Encrypt sensitive data in cache
import crypto from 'crypto';

class EncryptedCache {
  private encryptionKey: Buffer;

  constructor() {
    this.encryptionKey = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
  }

  encrypt(data: any): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);

    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  decrypt(encryptedData: string): any {
    const [ivHex, encrypted] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }
}
```

### 3. API Key Management

```bash
# Use environment variables for API keys
export CENSUS_API_KEY="your_census_api_key"
export CMS_API_KEY="your_cms_api_key"

# Or use a secrets management service
# AWS Secrets Manager, Azure Key Vault, HashiCorp Vault, etc.
```

## Performance Optimization

### 1. Production Optimizations

```bash
# Node.js production flags
NODE_ENV=production \
NODE_OPTIONS="--max-old-space-size=4096 --optimize-for-size" \
UV_THREADPOOL_SIZE=16 \
npm start
```

### 2. Database Optimization

```sql
-- DuckDB optimization settings for production
SET memory_limit = '8GB';
SET threads = 8;
SET enable_progress_bar = false;
SET enable_profiling = true;
SET profiling_output = '/var/log/fdb-mcp/duckdb-profile.json';

-- Create indexes for common queries
CREATE INDEX idx_healthcare_geography ON healthcare_data(county, state);
CREATE INDEX idx_healthcare_metrics ON healthcare_data(year, medicare_eligible);
CREATE INDEX idx_education_district ON education_data(district_name, state);
CREATE INDEX idx_transportation_metro ON transportation_data(metro_area, year);
CREATE INDEX idx_environment_county ON environment_data(county, monitoring_date);
```

### 3. Caching Strategy

```typescript
// Production cache configuration
const cacheConfig = {
  // Size-based configuration
  maxSize: 10000, // Increased for production

  // TTL configuration
  ttl: 600000, // 10 minutes for production
  staleWhileRevalidate: 120000, // 2 minutes stale serving

  // Compression settings
  compressionThreshold: 50000, // 50KB threshold

  // Cache warming
  warmupPatterns: [
    'Medicare eligibility analysis',
    'School district performance',
    'Air quality trends',
    'Traffic congestion analysis'
  ]
};
```

## Disaster Recovery

### 1. Backup Strategy

```bash
#!/bin/bash
# backup.sh - Daily backup script

BACKUP_DIR="/opt/backups/fdb-mcp"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR/$DATE

# Backup DuckDB databases
cp -r /opt/fdb-mcp/data/duckdb $BACKUP_DIR/$DATE/

# Backup application configuration
cp -r /opt/fdb-mcp/config $BACKUP_DIR/$DATE/

# Backup logs (last 7 days)
find /var/log/fdb-mcp -type f -mtime -7 -exec cp {} $BACKUP_DIR/$DATE/ \;

# Compress backup
tar -czf $BACKUP_DIR/fdb-mcp-backup-$DATE.tar.gz -C $BACKUP_DIR $DATE
rm -rf $BACKUP_DIR/$DATE

# Upload to cloud storage (AWS S3, Azure Blob, etc.)
# aws s3 cp $BACKUP_DIR/fdb-mcp-backup-$DATE.tar.gz s3://your-backup-bucket/

# Cleanup old backups (keep last 30 days)
find $BACKUP_DIR -type f -name "*.tar.gz" -mtime +30 -delete

echo "✅ Backup completed: fdb-mcp-backup-$DATE.tar.gz"
```

### 2. Recovery Procedures

```bash
#!/bin/bash
# recover.sh - Recovery script

BACKUP_FILE=$1
RECOVERY_DIR="/opt/fdb-mcp-recovery"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup-file>"
    exit 1
fi

echo "🔄 Starting recovery from $BACKUP_FILE"

# Stop services
sudo systemctl stop nginx
docker-compose -f docker-compose.prod.yml down

# Create recovery directory
mkdir -p $RECOVERY_DIR

# Extract backup
tar -xzf $BACKUP_FILE -C $RECOVERY_DIR

# Restore data
cp -r $RECOVERY_DIR/*/duckdb/* /opt/fdb-mcp/data/duckdb/

# Restore configuration
cp -r $RECOVERY_DIR/*/config/* /opt/fdb-mcp/config/

# Start services
docker-compose -f docker-compose.prod.yml up -d
sudo systemctl start nginx

# Verify recovery
sleep 30
curl -f http://localhost/health

echo "✅ Recovery completed"
```

## Maintenance & Updates

### 1. Update Process

```bash
#!/bin/bash
# update.sh - Application update script

set -e

echo "🔄 Starting FDB-MCP update process..."

# Create backup before update
./scripts/backup.sh

# Pull latest code
git fetch origin
git checkout main
git pull origin main

# Install new dependencies
npm ci --production

# Build application
npm run build

# Run database migrations (if any)
npm run migrate

# Run tests
npm test

# Deploy with zero downtime
./scripts/deploy.sh

echo "✅ Update completed successfully"
```

### 2. Monitoring Scripts

```bash
#!/bin/bash
# monitor.sh - System monitoring script

# Check application health
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health)

if [ "$HEALTH_STATUS" != "200" ]; then
    echo "❌ Application health check failed: $HEALTH_STATUS"
    # Send alert
    curl -X POST "https://your-monitoring-service.com/alert" \
         -H "Content-Type: application/json" \
         -d '{"message": "FDB-MCP health check failed", "severity": "critical"}'
fi

# Check disk space
DISK_USAGE=$(df /opt/fdb-mcp | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
    echo "⚠️ High disk usage: ${DISK_USAGE}%"
fi

# Check memory usage
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
if [ "$MEMORY_USAGE" -gt 85 ]; then
    echo "⚠️ High memory usage: ${MEMORY_USAGE}%"
fi

# Check container health
UNHEALTHY_CONTAINERS=$(docker ps --filter health=unhealthy --format "table {{.Names}}" | grep -v NAMES)
if [ ! -z "$UNHEALTHY_CONTAINERS" ]; then
    echo "❌ Unhealthy containers detected: $UNHEALTHY_CONTAINERS"
fi

echo "✅ System monitoring check completed"
```

### 3. Maintenance Schedule

Create `/etc/cron.d/fdb-mcp`:

```bash
# FDB-MCP Maintenance Schedule

# Daily backup at 2 AM
0 2 * * * root /opt/fdb-mcp/scripts/backup.sh

# Health check every 5 minutes
*/5 * * * * root /opt/fdb-mcp/scripts/monitor.sh

# Log rotation daily at 3 AM
0 3 * * * root /usr/sbin/logrotate /etc/logrotate.d/fdb-mcp

# Cache cleanup weekly on Sunday at 4 AM
0 4 * * 0 root /opt/fdb-mcp/scripts/cleanup-cache.sh

# Performance report weekly on Monday at 9 AM
0 9 * * 1 root /opt/fdb-mcp/scripts/performance-report.sh
```

## Best Practices Summary

### ✅ Do's

1. **Always run health checks** before and after deployments
2. **Monitor performance metrics** continuously
3. **Implement proper logging** with structured JSON format
4. **Use connection pooling** for database connections
5. **Enable caching** with appropriate TTL values
6. **Secure API endpoints** with rate limiting and authentication
7. **Backup data regularly** and test recovery procedures
8. **Use HTTPS** for all external communications
9. **Monitor external API quotas** and implement fallback strategies
10. **Scale horizontally** with load balancers

### ❌ Don'ts

1. **Don't store API keys** in code or version control
2. **Don't ignore performance alerts** or high error rates
3. **Don't deploy without testing** in staging environment
4. **Don't skip database migrations** during updates
5. **Don't run as root user** in production containers
6. **Don't ignore SSL certificate** expiration dates
7. **Don't forget to rotate logs** and manage disk space
8. **Don't disable security headers** in production
9. **Don't use default passwords** for Redis or other services
10. **Don't ignore monitoring alerts** or system resource usage

---

*For additional deployment support, please refer to the troubleshooting section or contact the operations team.*