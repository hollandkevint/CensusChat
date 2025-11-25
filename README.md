[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/hollandkevint-censuschat-badge.png)](https://mseep.ai/app/hollandkevint-censuschat)

# CensusChat: Healthcare Demographics Made Simple

**Natural language interface to US Census data for healthcare strategy teams**

*Transform 6-week $50K demographic consulting into 6-second $297/month queries*

**[🚀 Try Demo](http://localhost:3000)** • **[📊 Foundation Data](docs/MVP_STATUS.md)** • **[📖 Quick Start](QUICK_START.md)** • **[📧 Get Early Access](mailto:kevin@kevintholland.com?subject=CensusChat%20Early%20Access)**

---

## 🎉 **Production Status** (October 9, 2025)

[![True MCP Complete](https://img.shields.io/badge/True%20MCP-Operational-success?style=flat-square)](docs/MCP_IMPLEMENTATION_SUMMARY.md)
[![DuckDB Integration](https://img.shields.io/badge/DuckDB-1.3.2-blue?style=flat-square)](docs/references/duckdb/)
[![SQL Validation](https://img.shields.io/badge/SQL%20Security-Production-red?style=flat-square)](backend/src/validation/)
[![Test Coverage](https://img.shields.io/badge/Coverage-82%2B%25-brightgreen?style=flat-square)](backend/src/__tests__/)

- ✅ **TRUE MCP IMPLEMENTATION**: Production SQL validation layer with security policies operational
- ✅ **SQL Injection Protection**: Table/column allowlists, row limits, dangerous pattern blocking
- ✅ **Audit Compliance**: All queries logged to `/backend/logs/sql-audit.log` for HIPAA/GDPR
- ✅ **Real Data Validated**: 58 CA counties tested, 47 counties >1M population verified
- ✅ **End-to-End Flow**: Natural Language → Anthropic → MCP Validator → DuckDB → Results
- ✅ **Frontend Operational**: ChatInterface fully functional at `http://localhost:3002`
- ✅ **Production Grade**: JSON-RPC 2.0 protocol, @modelcontextprotocol/sdk, comprehensive logging

**Current Data**:
- **County Level**: 3,144 US counties with demographics
- **Block Group Level**: 239,741 block groups with 84 variables (age, income, education, housing, healthcare, technology)
**Performance**: Sub-5 second response times with MCP validation, 1,000 row limit enforced
**Security**: Only SELECT queries, no SQL injection, complete audit trail

### 🔒 **Enterprise Security Features**

**SQL Validation Layer** ([View Implementation](docs/MCP_IMPLEMENTATION_SUMMARY.md)):
- ✅ **SQL Injection Protection**: Only SELECT statements, blocks DROP/DELETE/UPDATE
- ✅ **Access Control**: Table allowlist (`county_data` only), column validation
- ✅ **Row Limits**: Maximum 1,000 rows per query enforced
- ✅ **Pattern Blocking**: Prevents comments (`--`, `/* */`), multi-statements, dangerous commands
- ✅ **Audit Trail**: Every query logged with timestamp, validation status, execution time
- ✅ **Compliance Ready**: HIPAA/GDPR compliant logging infrastructure

**MCP Protocol Implementation**:
- ✅ **JSON-RPC 2.0**: Industry-standard protocol with `@modelcontextprotocol/sdk`
- ✅ **3 MCP Tools**: `get_information_schema`, `validate_sql_query`, `execute_query`
- ✅ **2 MCP Resources**: `data://tables/county_data`, `data://schema`
- ✅ **Real Validation**: Tested with 58 CA counties, 47 counties >1M population

---

## 🎯 **The Problem**

Healthcare strategy teams wait **6+ weeks** and pay **$50K+** for demographic analysis that CensusChat delivers in **23 minutes** for **$297/month**.

```typescript
"Show me Medicare eligible seniors in Tampa Bay with household income over $75K"
→ Instant Excel export with confidence intervals
```

---

## ⚡ **How It Works**

### **1. Natural Language Input**
Ask questions in plain English - no SQL knowledge required

### **2. AI-Powered Processing with Security**
- **Claude Sonnet 4** translates natural language to SQL
- **MCP Validation Layer** validates SQL against security policies ([Details](docs/MCP_IMPLEMENTATION_SUMMARY.md))
  - Only SELECT statements allowed
  - Table/column allowlist enforcement
  - 1,000 row limit per query
  - Complete audit logging
- **DuckDB** executes validated queries on Census data

### **3. Professional Output**
- Excel-ready data with statistical metadata
- PDF reports for presentations
- Tableau/Power BI integration ready

---

## 🏥 **Built for Healthcare Professionals**

**Primary Users:**
- Business Analysts at health systems and Medicare Advantage plans
- Strategy Teams planning market expansion and facility placement
- Healthcare Researchers conducting population health studies

---

## 🛠 **Technical Foundation**

### **Architecture**
```typescript
const stack = {
  backend: "Node.js 20 + TypeScript + Express",
  frontend: "Next.js 15 + React 19 + Tailwind",
  databases: "PostgreSQL + Redis + DuckDB",
  ai: "Claude Sonnet 4 + Model Context Protocol",
  deployment: "Docker + containerized testing"
};
```

### **Performance Metrics**
- **Sub-2 Second Queries** maintained across all healthcare analytics
- **82%+ Test Coverage** with 35+ comprehensive test suites
- **Zero Production Crashes** with stable connection pooling
- **10+ Concurrent Queries** without performance degradation
- **HIPAA-Ready Architecture** with enterprise security and audit logging

**Innovation:** First healthcare platform combining MCP + Claude + DuckDB for validated, federated demographic analytics.

---

## 🚦 **Quick Start**

### **Step 1: Get API Keys** (Required)

CensusChat requires two API keys. See **[API_KEY_SETUP.md](API_KEY_SETUP.md)** for detailed instructions.

**Quick Setup:**
1. **Anthropic API**: Get key at [console.anthropic.com](https://console.anthropic.com/settings/keys)
2. **Census API**: Request key at [api.census.gov/data/key_signup.html](https://api.census.gov/data/key_signup.html)
3. Add both keys to `backend/.env`:
   ```bash
   ANTHROPIC_API_KEY=sk-ant-api03-YOUR-KEY-HERE
   CENSUS_API_KEY=your-census-key-here
   ```

### **Step 2: Load Census Data** (Required - First Time Only)

Before starting the application, you need to load real Census data into DuckDB. This is a one-time setup:

```bash
# From the root directory
cd backend

# Run the database setup script (takes 2-3 hours)
./scripts/setup-database.sh
```

**What this does:**
- ✅ Loads 239,741 block groups with 84 demographic variables
- ✅ Fetches real data from Census Bureau API for all 50 states + DC
- ✅ Creates `block_group_data_expanded` table with comprehensive demographics
- ✅ Includes age, income, education, housing, healthcare, and technology data

**Progress tracking:**
```bash
# Monitor progress in another terminal
tail -f backend/data/blockgroup-expanded-progress.json
```

### **Step 3: Start the Application**
```bash
# From the root directory
./demo-setup.sh
```

**That's it!** The demo setup will:
- ✅ Start PostgreSQL, Redis, Backend (port 3001), and Frontend (port 3000)
- ✅ Connect to your loaded DuckDB database
- ✅ Verify all services are healthy
- ✅ Open http://localhost:3000 in your browser

### **Alternative: Manual Setup**
```bash
# 1. Setup environment
cp .env.example .env  # Add your JWT_SECRET

# 2. Start with Docker Compose
docker-compose up -d

# 3. Access the application
open http://localhost:3000
```

### **Quick Test**
```bash
# Test the API
curl http://localhost:3001/health
# Returns: {"status":"healthy","timestamp":"..."}

# View all services
docker-compose ps
```

**📖 Setup Guides:**
- [API_KEY_SETUP.md](API_KEY_SETUP.md) - **Required: Get your API keys first**
- [QUICK_START.md](QUICK_START.md) - Local development setup
- [Railway Deployment Guide](docs/guides/RAILWAY_DEPLOYMENT.md) - Deploy to production in 15 minutes
- [SECURITY.md](SECURITY.md) - Security best practices and API key rotation

---

## 📊 **Features**

### **Healthcare-Specific Queries**
- Medicare eligibility calculations (age 65+ demographics)  
- Senior care demographics for facility planning
- Population health indicators and social determinants
- Market analysis for health system expansion

### **Professional Data Export**
- Excel exports with statistical confidence intervals
- CSV files for Tableau/Power BI integration
- PDF reports for board presentations
- Real-time query iteration capability

### **Enterprise Security**
- HIPAA-ready architecture with encryption
- SOC 2 compliance planning and audit trails
- No PHI storage - only aggregated demographic data
- API rate limiting and abuse prevention
- **API Key Protection**: Never commit credentials ([Setup Guide](API_KEY_SETUP.md))
- **Quarterly Key Rotation**: Automated security policies ([Security Policy](SECURITY.md))

---

## 📈 **Market Impact**

**Problem We Solve:**
- **$2.8B** spent annually on demographic consulting
- **6,090** hospitals needing demographic analysis
- **30,000+** senior care facilities planning expansion

**Our Solution:**
- **200x cost reduction**: $50K → $297/month
- **300x speed improvement**: 6 weeks → 23 minutes
- **Unlimited iterations** vs. limited consultant revisions

---

## 📚 **Documentation**

### **Getting Started**
- [📖 Quick Start Guide](QUICK_START.md) - Get running in 2 minutes
- [📊 MVP Status Report](docs/MVP_STATUS.md) - Complete production readiness overview
- [🔄 Changelog](CHANGELOG.md) - Complete project history including Epic 2

### **Technical Guides**
- [🏗️ System Architecture](docs/architecture/01-system-architecture.md) - Complete technical architecture
- [🗄️ DuckDB Reference](docs/references/duckdb/) - Comprehensive DuckDB integration guide
- [🔗 MCP Integration](docs/references/duckdb-mcp/) - Model Context Protocol implementation
- [📊 ACS Data Loading](docs/guides/ACS_DATA_LOADING.md) - Load production Census data
- [🚀 Railway Deployment](docs/guides/RAILWAY_DEPLOYMENT.md) - Deploy to production in 15 minutes
- [🧪 Testing Guide](docs/TESTING_GUIDE.md) - Comprehensive testing infrastructure
- [📡 API Documentation](docs/api/) - REST API reference and deployment guides

### **Product Resources**
- [👥 User Personas](docs/USER_PERSONAS.md) - Healthcare analyst profiles
- [🗺️ Feature Roadmap](docs/FEATURE_ROADMAP.md) - Development roadmap
- [✅ Epic Documentation](docs/epics/) - Epic 2 complete, Epic 3 planning

---

## 🚀 **Get Involved**

### **For Healthcare Teams**
**[📧 Request Early Access](mailto:kevin@kevintholland.com?subject=CensusChat%20Early%20Access&body=Organization:%0ARole:%0ACurrent%20demographic%20analysis%20challenges:)** - Join 5 healthcare organizations in pilot program

### **For Developers**
**[💬 Technical Discussion](https://github.com/hollandkevint/CensusChat/discussions)** - Architecture, MCP integration, and healthcare data patterns

### **For Contributors**
- Write quality TypeScript with 90%+ test coverage
- All features must serve healthcare users
- Maintain sub-2s query response times
- Follow HIPAA-ready security practices
- **Security First**:
  - Never commit API keys or secrets ([API Key Setup](API_KEY_SETUP.md))
  - Review [SECURITY.md](SECURITY.md) before contributing
  - Use `.env` files for all credentials (already in `.gitignore`)
  - Run `npm run secret-scan` before committing

---

**⭐ Star this repository if CensusChat helps your healthcare data work**

*Transforming healthcare demographic analysis from weeks to seconds*

---

### 👤 **About Kevin Holland**

10+ years healthcare data experience • Frustrated by $50K consulting delays

**[📖 Read Kevin's Full Story](https://www.kevintholland.com)** | **[📧 Get Updates](mailto:kevin@kevintholland.com?subject=CensusChat%20Updates)**

</div>
