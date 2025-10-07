# Railway Deployment Guide
## Deploy CensusChat to Production in 15 Minutes

**Goal**: Deploy CensusChat to Railway.app for external access with custom domain and production-grade infrastructure.

**Timeline**: 15-20 minutes
**Cost**: ~$20/month (backend + databases)
**Result**: Publicly accessible at `censuschat.up.railway.app` or custom domain

---

## Prerequisites

✅ **GitHub Repository**: Code pushed to GitHub (public or private)
✅ **Census API Key**: From https://api.census.gov/data/key_signup.html
✅ **Railway Account**: Sign up at https://railway.com (GitHub OAuth recommended)
✅ **Local Testing Complete**: System working locally with production data

---

## Quick Start (15 Minutes)

### **Step 1: Create Railway Project (2 minutes)**

```bash
# 1. Visit Railway
open https://railway.com

# 2. Sign up with GitHub (recommended)
# - Click "Login with GitHub"
# - Authorize Railway access

# 3. Create new project
# - Click "New Project"
# - Select "Deploy from GitHub repo"
# - Choose: hollandkevint/CensusChat
```

### **Step 2: Deploy Backend Service (3 minutes)**

**In Railway Dashboard:**

1. **Select Backend Directory**
   - Root Directory: `/backend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`

2. **Configure Service Settings**
   ```
   Service Name: censuschat-backend
   Port: 3001
   Health Check Path: /health
   ```

3. **Deploy**
   - Click "Deploy"
   - Wait for build to complete (~2 minutes)

### **Step 3: Add PostgreSQL Database (1 minute)**

```bash
# In Railway Dashboard:
# 1. Click "+ New Service"
# 2. Select "Database" → "PostgreSQL"
# 3. Railway auto-generates credentials

# PostgreSQL will be automatically connected to your backend
```

**Auto-generated Environment Variables:**
- `DATABASE_URL` - Full connection string
- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`

### **Step 4: Add Redis Cache (1 minute)**

```bash
# In Railway Dashboard:
# 1. Click "+ New Service"
# 2. Select "Database" → "Redis"
# 3. Railway auto-generates credentials

# Redis will be automatically connected to your backend
```

**Auto-generated Environment Variables:**
- `REDIS_URL` - Full connection string
- `REDIS_HOST`, `REDIS_PORT`

### **Step 5: Configure Environment Variables (3 minutes)**

**In Backend Service Settings → Variables:**

```bash
# Census API
CENSUS_API_KEY=your_census_api_key_here

# JWT Secret (generate new for production)
JWT_SECRET=your_production_jwt_secret_here

# Node Environment
NODE_ENV=production

# CORS (add your frontend domain later)
ALLOWED_ORIGINS=https://censuschat.vercel.app,https://censuschat.com

# Optional: Anthropic for MCP
ANTHROPIC_API_KEY=your_anthropic_key_here
```

**Generate Secure JWT Secret:**
```bash
# Run locally to generate
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### **Step 6: Deploy Frontend to Vercel (3 minutes)**

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Deploy from frontend directory
cd frontend
vercel

# 3. Follow prompts:
# - Link to existing project? No
# - Project name? censuschat
# - Framework preset? Next.js
# - Root directory? ./
```

**Configure Frontend Environment:**

In Vercel Dashboard → Settings → Environment Variables:
```bash
NEXT_PUBLIC_API_URL=https://censuschat-backend.up.railway.app
```

### **Step 7: Connect Services (2 minutes)**

**Update Backend CORS:**

In Railway → Backend Service → Variables:
```bash
ALLOWED_ORIGINS=https://censuschat.vercel.app,https://censuschat.com
```

**Redeploy Backend:**
- Click "Deploy" in Railway dashboard
- Wait for deployment (~1 minute)

### **Step 8: Verify Deployment (2 minutes)**

```bash
# Test Backend Health
curl https://censuschat-backend.up.railway.app/health
# Should return: {"status":"healthy","timestamp":"..."}

# Test Frontend
open https://censuschat.vercel.app

# Test Query
# In frontend, ask: "Show me all counties in Texas"
# Should return real Census data
```

---

## Custom Domain Setup (Optional)

### **Backend Domain (Railway)**

**In Railway → Backend Service → Settings → Domains:**

1. **Add Custom Domain**
   ```
   api.censuschat.com
   ```

2. **Configure DNS (in your domain provider)**
   ```
   Type: CNAME
   Name: api
   Value: censuschat-backend.up.railway.app
   TTL: 3600
   ```

3. **Wait for SSL** (~5 minutes)
   - Railway auto-provisions SSL certificate
   - Status will change to "Active"

### **Frontend Domain (Vercel)**

**In Vercel → Project Settings → Domains:**

1. **Add Domain**
   ```
   censuschat.com
   www.censuschat.com
   ```

2. **Configure DNS**
   ```
   Type: A
   Name: @
   Value: 76.76.21.21

   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```

3. **Update Backend CORS**
   ```bash
   ALLOWED_ORIGINS=https://censuschat.com,https://www.censuschat.com
   ```

---

## Database Migration & Data Loading

### **Method 1: Load ACS Data Directly on Railway**

```bash
# 1. Connect to Railway PostgreSQL locally
railway link
railway run npm run load-acs-data

# This will:
# - Connect to Railway's PostgreSQL
# - Load 3,143 counties from Census API
# - Populate production database
```

### **Method 2: Upload DuckDB File**

```bash
# 1. Create DuckDB with production data locally
cd backend
npm run load-acs-data

# 2. Railway uses ephemeral filesystem
# Better to use PostgreSQL for persistence

# 3. Convert DuckDB → PostgreSQL
npm run migrate:duckdb-to-postgres
```

### **Method 3: Automated Data Refresh**

**Create Railway Cron Job:**

In Railway → New Service → Cron:
```bash
Schedule: 0 2 1 * *  # 2am on 1st of month
Command: npm run load-acs-data
```

---

## Monitoring & Logs

### **Railway Dashboard**

**View Logs:**
```bash
# In Railway Dashboard:
# 1. Select Backend Service
# 2. Click "Deployments" tab
# 3. View real-time logs

# Or use Railway CLI:
railway logs --service censuschat-backend
```

**Monitor Performance:**
- CPU usage
- Memory usage
- Request count
- Response times

**Set Alerts:**
- Settings → Notifications
- Configure Slack/Email alerts for:
  - High CPU (>80%)
  - Memory spikes
  - Deployment failures
  - Health check failures

### **Health Checks**

**Backend Health Endpoint:**
```typescript
// Already configured in backend/src/index.ts
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      postgres: 'connected',
      redis: 'connected',
      duckdb: 'available'
    }
  });
});
```

**Railway Health Check Config:**
```
Path: /health
Interval: 30s
Timeout: 10s
Success Threshold: 2
```

---

## Scaling Configuration

### **Vertical Scaling (Automatic)**

Railway auto-scales resources based on usage:
- **Starter**: 512MB RAM, 1 vCPU
- **Scale up**: Up to 32GB RAM, 8 vCPU
- **Billing**: Pay only for what you use

### **Horizontal Scaling (Manual)**

**Add Replicas:**
```bash
# In Railway Dashboard:
# 1. Backend Service → Settings → Replicas
# 2. Set: 2-3 replicas for high availability
# 3. Railway auto-load balances requests
```

**Configure Auto-Sleep (Development Only):**
```bash
# Settings → Auto Sleep
# Enabled: Save costs when inactive
# Wake time: <1 second on first request
```

---

## Security Configuration

### **Environment Secrets**

**Never commit to GitHub:**
- ✅ All secrets in Railway Variables
- ✅ Use `.env.example` templates only
- ✅ Rotate secrets quarterly

**Production Secrets Checklist:**
- [ ] `JWT_SECRET` - Unique 64-char hex
- [ ] `CENSUS_API_KEY` - From Census Bureau
- [ ] `ANTHROPIC_API_KEY` - From Anthropic Console
- [ ] `DATABASE_URL` - Railway auto-generated
- [ ] `REDIS_URL` - Railway auto-generated

### **CORS Configuration**

**Restrict Origins:**
```typescript
// backend/src/index.ts
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'https://censuschat.com',
  'https://www.censuschat.com',
  'https://censuschat.vercel.app'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
```

### **Rate Limiting**

**Add to Backend:**
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later'
});

app.use('/api/', limiter);
```

---

## Cost Estimation

### **Railway Costs**

**Monthly Pricing:**
```
Backend Service (Starter):     $5/month
PostgreSQL Database:            $5/month
Redis Cache:                    $5/month
Bandwidth (10GB included):      $0
Additional Bandwidth:           $0.10/GB

Estimated Total:                $15/month
```

**Vercel Costs (Frontend):**
```
Hobby Plan (Free):              $0/month
- 100GB bandwidth
- 100 serverless functions
- SSL included

Pro Plan (if needed):           $20/month
- 1TB bandwidth
- Advanced analytics
```

**Total Monthly Cost:**
```
Development:                    $15/month (Railway + Vercel Free)
Production:                     $35/month (Railway + Vercel Pro)
```

---

## Deployment Checklist

### **Pre-Deployment**
- [ ] Code pushed to GitHub
- [ ] All tests passing locally
- [ ] Production data loaded and tested
- [ ] Environment variables documented
- [ ] CORS origins defined
- [ ] Health checks implemented

### **Railway Setup**
- [ ] Project created and linked to GitHub
- [ ] Backend service deployed
- [ ] PostgreSQL database added
- [ ] Redis cache added
- [ ] Environment variables configured
- [ ] Health checks enabled

### **Frontend Setup**
- [ ] Deployed to Vercel
- [ ] API URL configured
- [ ] Custom domain added (optional)
- [ ] SSL certificate active

### **Post-Deployment**
- [ ] Backend health check passing
- [ ] Frontend loads successfully
- [ ] Test queries returning data
- [ ] Excel export working
- [ ] Logs show no errors
- [ ] Monitoring alerts configured

### **External Access**
- [ ] Share URL with beta testers
- [ ] Document known limitations
- [ ] Set up feedback collection
- [ ] Monitor usage patterns

---

## Troubleshooting

### **Build Fails**

**Symptom:** Railway build errors

**Solutions:**
```bash
# Check build logs in Railway dashboard
# Common issues:

# 1. Missing dependencies
npm install --production=false

# 2. TypeScript compilation errors
npm run build

# 3. Node version mismatch
# Add to package.json:
"engines": {
  "node": ">=20.0.0"
}
```

### **Database Connection Issues**

**Symptom:** "Cannot connect to database"

**Solutions:**
```bash
# 1. Verify environment variables
# In Railway → Variables → Check DATABASE_URL exists

# 2. Test connection locally
railway run node -e "require('./src/db').testConnection()"

# 3. Check PostgreSQL service status
# In Railway → PostgreSQL service → Status should be "Active"
```

### **CORS Errors**

**Symptom:** "Blocked by CORS policy"

**Solutions:**
```bash
# 1. Verify ALLOWED_ORIGINS includes frontend URL
# Railway → Backend → Variables

# 2. Check frontend is using correct API URL
# Vercel → Environment Variables → NEXT_PUBLIC_API_URL

# 3. Ensure credentials: true in both places
```

### **Slow Query Performance**

**Symptom:** Queries taking >2 seconds

**Solutions:**
```bash
# 1. Check database indexes
# Railway → PostgreSQL → Run:
CREATE INDEX idx_state ON county_data(state);
CREATE INDEX idx_county ON county_data(county);

# 2. Monitor resource usage
# Railway → Backend → Metrics tab

# 3. Scale up if needed
# Settings → Increase RAM/CPU limits
```

---

## External Access Guide

### **Sharing with Beta Testers**

**Create Access Instructions:**

```markdown
# CensusChat Beta Access

Welcome to CensusChat! Here's how to get started:

## Access the Application
🔗 **URL**: https://censuschat.vercel.app
🔐 **No login required** (beta testing)

## Try These Queries
1. "Show me all counties in Texas"
2. "Medicare eligible seniors in Florida"
3. "Counties with median income over $75,000"
4. "Compare poverty rates in California and New York"

## Features to Test
✅ Natural language queries
✅ Excel export (click "Export" button)
✅ Response time (<2 seconds)
✅ Data accuracy

## Provide Feedback
📧 Email: kevin@kevintholland.com
📋 Issues: https://github.com/hollandkevint/CensusChat/issues

Thank you for helping improve CensusChat!
```

### **Public Launch Checklist**

**Before Public Release:**
- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] Rate limiting configured
- [ ] Analytics implemented
- [ ] Error monitoring (Sentry)
- [ ] Backup strategy defined
- [ ] Support email configured
- [ ] Documentation complete

---

## Rollback Procedure

**If deployment fails:**

```bash
# 1. In Railway Dashboard → Deployments
# 2. Find last working deployment
# 3. Click "..." → "Rollback to this deployment"
# 4. Confirm rollback

# Rollback completes in ~30 seconds
```

**Or via CLI:**
```bash
railway rollback
```

---

## Next Steps After Deployment

1. **Monitor First 24 Hours**
   - Watch logs for errors
   - Track response times
   - Monitor resource usage

2. **Collect Beta Feedback**
   - Send access instructions to 10 beta users
   - Create feedback form
   - Schedule follow-up interviews

3. **Optimize Performance**
   - Add database indexes based on query patterns
   - Implement caching for common queries
   - Consider CDN for frontend assets

4. **Plan for Scale**
   - Set up auto-scaling rules
   - Configure backup automation
   - Implement monitoring alerts

---

## Support Resources

- **Railway Docs**: https://docs.railway.com
- **Vercel Docs**: https://vercel.com/docs
- **CensusChat Docs**: `/docs/README.md`
- **Technical Support**: Create GitHub issue
- **Email Support**: kevin@kevintholland.com

---

## Quick Reference Commands

```bash
# Link to Railway project
railway link

# View logs
railway logs

# Run commands on Railway environment
railway run npm run load-acs-data

# Deploy latest changes
git push origin main  # Auto-deploys to Railway & Vercel

# SSH into Railway container (debugging)
railway shell

# Check service status
railway status
```

---

**Deployment Status**: Ready to deploy ✅
**Estimated Time**: 15-20 minutes
**Next Action**: Create Railway account and deploy backend
