# CensusChat: Healthcare Demographics Made Simple

**Natural language interface to US Census data for healthcare strategy teams**

*Transform 6-week $50K demographic consulting into 6-second $297/month queries*

**[📊 Foundation Data](docs/MVP_STATUS.md)** • **[📖 Quick Start](QUICK_START.md)** • **[📧 Get Early Access](mailto:kevin@kevintholland.com?subject=CensusChat%20Early%20Access)**

---

## 🎉 **v1 Shipped** (February 3, 2026)

[![DuckDB 1.4](https://img.shields.io/badge/DuckDB-1.4.3-blue?style=flat-square)](docs/references/duckdb/)
[![MCP HTTP](https://img.shields.io/badge/MCP-HTTP%20Transport-success?style=flat-square)](docs/MCP_IMPLEMENTATION_SUMMARY.md)
[![Agent SDK](https://img.shields.io/badge/Claude-Agent%20SDK-purple?style=flat-square)](backend/src/agent/)
[![Interactive UI](https://img.shields.io/badge/UI-MCP%20Apps-orange?style=flat-square)](mcp-apps/)

### What's New in v1

- **DuckDB 1.4** — New async API, MERGE statements, encryption support, query profiler
- **MCP HTTP Transport** — External client connections (Claude Desktop, Postman)
- **Interactive Data Tables** — TanStack Table with sorting, filtering, pagination, drill-down
- **Chart Visualizations** — Recharts bar/line charts with export controls
- **Claude Agent SDK** — Zod schema validation, parallel region comparison, conversational context
- **Document Generation** — Excel and PDF reports via MCP tools

### Core Features

- ✅ **TRUE MCP IMPLEMENTATION**: Production SQL validation layer with security policies
- ✅ **SQL Injection Protection**: Table/column allowlists, row limits, dangerous pattern blocking
- ✅ **Interactive Results**: Sortable tables, filterable data, drill-down navigation
- ✅ **Parallel Queries**: "Compare Tampa Bay vs Phoenix" runs both simultaneously
- ✅ **Conversational Context**: "Now filter to income > $75K" understands prior query
- ✅ **Audit Compliance**: All queries logged for HIPAA/GDPR

**Current Data**:
- **County Level**: 3,144 US counties with demographics
- **Block Group Level**: 239,741 block groups with 84 variables

---

## 🎯 **The Problem**

Healthcare strategy teams wait **6+ weeks** and pay **$50K+** for demographic analysis that CensusChat delivers in **seconds** for **$297/month**.

```typescript
"Compare Medicare eligible seniors in Tampa Bay vs Phoenix with income over $75K"
→ Parallel queries, interactive comparison table, instant Excel export
```

---

## ⚡ **How It Works**

### **1. Natural Language Input**
Ask questions in plain English - no SQL knowledge required

### **2. AI-Powered Processing with Security**
- **Claude Sonnet 4** translates natural language to SQL
- **MCP Validation Layer** validates SQL against security policies
- **DuckDB 1.4** executes validated queries on Census data
- **Agent SDK** handles parallel queries and conversational context

### **3. Interactive Output**
- Sortable, filterable data tables
- Bar and line chart visualizations
- Drill-down from county to block groups
- Excel/PDF export with one click

---

## 🏥 **Built for Healthcare Professionals**

**Primary Users:**
- Business Analysts at health systems and Medicare Advantage plans
- Strategy Teams planning market expansion and facility placement
- Healthcare Researchers conducting population health studies

---

## 🛠 **Technical Stack**

```typescript
const stack = {
  backend: "Node.js 20 + TypeScript + Express 5",
  frontend: "Next.js 15 + React 19 + Tailwind CSS 4",
  databases: "PostgreSQL 15 + Redis 7 + DuckDB 1.4.3",
  ai: "Claude Sonnet 4 + Agent SDK 0.2.30 + MCP SDK 1.25.3",
  interactive: "TanStack Table + Recharts + MCP Apps",
  deployment: "Docker + containerized testing"
};
```

### **Performance Metrics**
- **Sub-2 Second Queries** with MCP validation
- **Parallel Execution** for comparison queries
- **82%+ Test Coverage** with comprehensive test suites
- **HIPAA-Ready Architecture** with encryption and audit logging

---

## 🚦 **Quick Start**

### **Step 1: Get API Keys** (Required)

See **[API_KEY_SETUP.md](API_KEY_SETUP.md)** for detailed instructions.

1. **Anthropic API**: Get key at [console.anthropic.com](https://console.anthropic.com/settings/keys)
2. **Census API**: Request key at [api.census.gov/data/key_signup.html](https://api.census.gov/data/key_signup.html)
3. Add both keys to `backend/.env`

### **Step 2: Load Census Data** (First Time Only)

```bash
cd backend
./scripts/setup-database.sh  # Takes 2-3 hours
```

### **Step 3: Start the Application**

```bash
./demo-setup.sh
```

Open http://localhost:3000 and start querying.

---

## 📊 **Features**

### **Healthcare-Specific Queries**
- Medicare eligibility calculations (age 65+ demographics)
- Senior care demographics for facility planning
- Population health indicators and social determinants
- Market analysis for health system expansion

### **Interactive Data Exploration**
- Click column headers to sort
- Filter rows without re-querying
- Drill down from county to block groups
- Export selected columns to Excel/CSV

### **Comparison Queries**
- "Compare Tampa Bay vs Phoenix" runs in parallel
- Side-by-side demographic breakdowns
- Automatic chart generation for comparisons

### **Conversational Follow-up**
- "Show seniors in Tampa Bay"
- "Now filter to income over $75K" (understands context)
- "Export that to Excel"

### **Enterprise Security**
- HIPAA-ready architecture with encryption at rest
- SQL injection protection with validation layer
- Complete audit trail for compliance
- No PHI storage - only aggregated demographic data

---

## 📚 **Documentation**

### **Getting Started**
- [📖 Quick Start Guide](QUICK_START.md)
- [🔑 API Key Setup](API_KEY_SETUP.md)
- [📊 MVP Status Report](docs/MVP_STATUS.md)

### **Technical Guides**
- [🏗️ System Architecture](docs/architecture/01-system-architecture.md)
- [🗄️ DuckDB Reference](docs/references/duckdb/)
- [🔗 MCP Implementation](docs/MCP_IMPLEMENTATION_SUMMARY.md)
- [🧪 Testing Guide](docs/TESTING_GUIDE.md)

### **Deployment**
- [🚀 Railway Deployment](docs/guides/RAILWAY_DEPLOYMENT.md)
- [🔒 Security Policy](SECURITY.md)

---

## 📈 **Market Impact**

**Problem We Solve:**
- **$2.8B** spent annually on demographic consulting
- **6,090** hospitals needing demographic analysis
- **30,000+** senior care facilities planning expansion

**Our Solution:**
- **200x cost reduction**: $50K → $297/month
- **300x speed improvement**: 6 weeks → seconds
- **Unlimited iterations** with conversational follow-up

---

## 🚀 **Get Involved**

### **For Healthcare Teams**
**[📧 Request Early Access](mailto:kevin@kevintholland.com?subject=CensusChat%20Early%20Access)**

### **For Developers**
- Write quality TypeScript with 90%+ test coverage
- Maintain sub-2s query response times
- Follow HIPAA-ready security practices
- Run `npm run secret-scan` before committing

---

**⭐ Star this repository if CensusChat helps your healthcare data work**

*Transforming healthcare demographic analysis from weeks to seconds*

---

### 👤 **About Kevin Holland**

10+ years healthcare data experience • Frustrated by $50K consulting delays

**[📖 Read Kevin's Full Story](https://www.kevintholland.com)** | **[📧 Get Updates](mailto:kevin@kevintholland.com?subject=CensusChat%20Updates)**
