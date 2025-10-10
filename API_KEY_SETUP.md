# API Key Setup Guide

Complete guide for obtaining and configuring ALL API keys required for CensusChat.

## 📋 Required API Keys

CensusChat requires two API keys to function:

1. **Anthropic API Key** - For Claude AI natural language processing
2. **Census Bureau API Key** - For accessing US Census data

---

## 🔑 Anthropic API Key Setup

### Step 1: Create Anthropic Account

1. Visit [https://console.anthropic.com/](https://console.anthropic.com/)
2. Sign up for a new account or log in with existing credentials
3. Verify your email address

### Step 2: Generate API Key

1. Navigate to **Settings** → **API Keys**
2. Click **"Create Key"**
3. Give your key a descriptive name (e.g., "CensusChat Development")
4. Click **"Create Key"**
5. **IMPORTANT**: Copy the key immediately - you won't be able to see it again!

**Key Format**: `sk-ant-api03-...` (starts with `sk-ant-api03-`)

### Step 3: Pricing & Usage

- **Free Tier**: $5 credit for new users
- **Pay-as-you-go**: After free credits
- **Typical Cost**: ~$0.03 per query (Claude Sonnet 4)
- **Monthly Estimate**: ~$10-50 depending on usage

**Monitor Usage**: Check [console.anthropic.com/account/usage](https://console.anthropic.com/account/usage)

---

## 📊 Census Bureau API Key Setup

### Step 1: Request API Key

1. Visit [https://api.census.gov/data/key_signup.html](https://api.census.gov/data/key_signup.html)
2. Fill out the registration form:
   - Organization name (can use personal name for development)
   - Email address (you'll receive key via email)
   - **Example Use Case Description:**
   ```
   CensusChat: Natural language interface for U.S. Census data analysis.
   Usage: Loading ACS 5-year estimates for states, counties, and census tracts.
   Expected: ~2,000-5,000 API calls per day for data loading and user queries.
   ```
3. Submit the form

### Step 2: Retrieve Your Key

1. Check your email for "Your Census API Key Request"
2. Email will contain your API key (usually within 1-2 business days)
3. Key is typically delivered within 5 minutes to 1 week

**Key Format**: 40-character alphanumeric string (e.g., `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0`)

### Step 3: Usage & Limits

- **Free Tier**: Completely free, no credit card required
- **Without Key**: 500 requests per IP per day
- **With Key**: 10,000+ requests per day
- **Commercial Use**: Allowed for both commercial and non-commercial use

---

## ⚙️ Environment Configuration

### Step 1: Copy Environment Template

```bash
# From the project root directory
cp .env.example .env
cd backend
cp .env.example .env
```

### Step 2: Add Your API Keys to backend/.env

Edit `backend/.env` and add your keys:

```bash
# backend/.env file
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:3000,http://localhost:3003

# =====================================
# API KEYS - ADD YOUR KEYS HERE
# =====================================
ANTHROPIC_API_KEY=sk-ant-api03-YOUR-KEY-HERE
CENSUS_API_KEY=your-40-character-census-key-here

# Database Configuration (keep defaults for development)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=censuschat
POSTGRES_USER=censuschat_user
POSTGRES_PASSWORD=dev_postgres_password_2024
POSTGRES_SSL=false

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# DuckDB Configuration
DUCKDB_PATH=./data/census.duckdb
USE_PRODUCTION_DUCKDB=true

# JWT Configuration (keep default for development, change for production)
JWT_SECRET=dev_secret_key_2024_censuschat_min_32_chars_for_development_only
JWT_EXPIRES_IN=24h
```

### Step 3: Verify Configuration

```bash
# Test that environment variables are loaded correctly
cd backend
npm run dev

# You should see:
# ✅ Anthropic API configured
# ✅ Census API configured
# 🚀 Server running on http://localhost:3001
```

---

## 🧪 Testing Your Setup

### Test 1: Backend Health Check

```bash
curl http://localhost:3001/health

# Expected response:
# {"status":"healthy","timestamp":"2025-10-09T..."}
```

### Test 2: Simple Query Test

```bash
curl -X POST http://localhost:3001/api/v1/queries \
  -H "Content-Type: application/json" \
  -d '{"query": "How many counties are in California?"}'

# Should return Census data about California counties
```

### Test 3: Frontend Integration

1. Start the backend (Terminal 1):
   ```bash
   cd backend
   npm run dev
   ```

2. Start the frontend (Terminal 2):
   ```bash
   cd frontend
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000)

4. Try test queries:
   - "Show me all counties in Texas"
   - "Medicare eligible seniors in Florida"
   - Should return results with explanation and refinements

---

## 🔒 Security Best Practices

### DO ✅

- **Keep keys in `.env` file only** - Never commit to git
- **Use different keys for each environment** (dev, staging, production)
- **Rotate keys quarterly** - Generate new keys every 3 months
- **Monitor API usage** - Check for unusual patterns
- **Revoke compromised keys immediately** - Generate new ones

### DON'T ❌

- **Never commit `.env` files** to version control
- **Never hardcode keys** in source code
- **Never share keys** in screenshots, logs, or documentation
- **Never use production keys** in development
- **Never push keys to public repositories**

### If You Accidentally Expose a Key:

1. **Immediately revoke the exposed key** at the provider's console
2. **Generate a new key** and update `.env`
3. **Check git history**: `git log --all -- backend/.env`
4. **If in git history, clean it**: Use BFG Repo-Cleaner or git-filter-repo
5. **Force push cleaned history** (coordinate with team first)

---

## 🔄 API Key Rotation Schedule

**Recommended rotation schedule:**

- **Development**: Every 6 months
- **Staging**: Every 3 months
- **Production**: Every 1 month

### How to Rotate Keys:

#### Anthropic API Key:
1. Go to [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. Click "Create Key" to generate new key
3. Update `backend/.env` with `ANTHROPIC_API_KEY=new-key`
4. Test the application
5. Delete old key from Anthropic console

#### Census API Key:
1. Request new key at [api.census.gov/data/key_signup.html](https://api.census.gov/data/key_signup.html)
2. Wait for email with new key
3. Update `backend/.env` with `CENSUS_API_KEY=new-key`
4. Test the application
5. Old key expires automatically after 90 days of inactivity

---

## ❓ Troubleshooting

### Issue: "Anthropic API key not configured"

**Solutions:**
1. Verify `backend/.env` file exists
2. Check that `ANTHROPIC_API_KEY` is set and starts with `sk-ant-api03-`
3. Restart the backend server after updating `.env`
4. Check for typos or extra spaces in the key
5. Verify no quotes around the key value in `.env`

### Issue: "Census API rate limit exceeded"

**Solutions:**
1. **Without key**: 500 requests/day per IP (wait until midnight EST)
2. **With key**: 10,000 requests/day (request higher limit from Census Bureau)
3. Implement caching to reduce API calls
4. Check `backend/logs/` for rate limit tracking

### Issue: "Invalid API key format"

**Solutions:**
1. **Anthropic**: Must start with `sk-ant-api03-` (no spaces or quotes)
2. **Census**: 40-character alphanumeric string (no dashes or spaces)
3. Remove any extra spaces, quotes, or newlines from `.env` file
4. Regenerate key if format seems incorrect

### Issue: "Environment variables not loading"

**Solutions:**
1. Ensure `.env` file is in `backend/` directory (NOT root)
2. Check for syntax errors in `.env` file (no spaces around `=`)
3. Restart the application after changes
4. Verify `dotenv` package is installed: `cd backend && npm list dotenv`
5. Check file permissions: `.env` should be readable

### Issue: "CORS errors in frontend"

**Solutions:**
1. Update `CORS_ORIGIN` in `backend/.env`:
   ```bash
   CORS_ORIGIN=http://localhost:3000,http://localhost:3003
   ```
2. Restart backend server
3. Clear browser cache
4. Try different port if needed

---

## 📞 Support & Resources

### For API Key Issues:

- **Anthropic Support**: support@anthropic.com
- **Anthropic Docs**: [docs.anthropic.com](https://docs.anthropic.com/)
- **Census Support**: cnmp.developers.list@census.gov
- **Census Docs**: [census.gov/developers](https://www.census.gov/data/developers/guidance.html)

### For CensusChat Setup:

- **GitHub Issues**: [github.com/hollandkevint/CensusChat/issues](https://github.com/hollandkevint/CensusChat/issues)
- **Email**: kevin@kevintholland.com
- **Documentation**: [CensusChat Docs](docs/)

---

## 🔗 Additional Resources

- [Anthropic API Documentation](https://docs.anthropic.com/)
- [Census Bureau API Documentation](https://www.census.gov/data/developers/data-sets.html)
- [CensusChat Security Policy](SECURITY.md)
- [Environment Variables Best Practices](https://12factor.net/config)
- [Census API-Specific Setup Guide](docs/API_KEY_SETUP.md)

---

## ✅ Setup Checklist

- [ ] Created Anthropic account and generated API key
- [ ] Requested and received Census Bureau API key
- [ ] Created `backend/.env` file from template
- [ ] Added both API keys to `backend/.env`
- [ ] Tested backend health check (`curl http://localhost:3001/health`)
- [ ] Tested query endpoint with sample query
- [ ] Started frontend and tested full integration
- [ ] Verified `.env` file is in `.gitignore`
- [ ] Set calendar reminder for key rotation (3-6 months)

---

**Next Steps:**
1. ✅ Complete the setup checklist above
2. ✅ Review [SECURITY.md](SECURITY.md) for best practices
3. ✅ Start building with CensusChat!

**Security Reminder**: Never commit `.env` files or share API keys publicly. If you accidentally expose a key, revoke it immediately and generate a new one.
