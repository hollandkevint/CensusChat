# CensusChat: Healthcare Demographics Made Simple

**Natural language interface to US Census data for healthcare strategy teams**

*Query 3,144 US counties and 239,741 census block groups in plain English. Get an Excel-ready answer back.*

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
- **MCP stdio Transport** — Run the MCP server standalone in [Claude Desktop](docs/guides/MCP_STDIO_SETUP.md), no web app required
- **Interactive Data Tables** — TanStack Table with sorting, filtering, pagination, drill-down
- **Chart Visualizations** — Recharts bar/line charts with export controls
- **Claude Agent SDK** — Zod schema validation, parallel region comparison, conversational context
- **Document Generation** — Excel and PDF reports via MCP tools

### Core Features

- ✅ **Enterprise Security**: Privacy-first architecture with encryption at rest
- ✅ **SQL Injection Protection**: Table/column allowlists, row limits, dangerous pattern blocking
- ✅ **Interactive Results**: Sortable tables, filterable data, drill-down navigation
- ✅ **Parallel Queries**: "Compare Tampa Bay vs Phoenix" runs both simultaneously
- ✅ **Conversational Context**: "Now filter to income > $75K" understands prior query
- ✅ **Audit Compliance**: All queries logged

**Current Data**:
- **County Level**: 3,144 US counties with demographics
- **Block Group Level**: 239,741 block groups with 84 variables

---

## 🎯 **The Problem**

Healthcare strategy teams wait weeks and pay tens of thousands of dollars for demographic analysis. CensusChat answers the same questions from ACS data.

*The **6-week, $50K** consulting baseline used throughout this README is an estimate drawn from the maintainer's own experience buying and delivering this work. It is not a published benchmark.*

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

### **Performance Targets**
- **Sub-2 second query responses** — the target contributors maintain, not a measured guarantee
- **30-second request timeout** enforced in `backend/src/routes/query.routes.ts`, covering MCP validation and the Anthropic API round trip
- **Parallel Execution** for comparison queries
- **Comprehensive test suites** with CI on every push
- **Privacy-first architecture** with encryption, audit logging, and no PHI stored

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
- [🖥️ Claude Desktop Setup (MCP stdio)](docs/guides/MCP_STDIO_SETUP.md)
- [🧪 Testing Guide](docs/TESTING_GUIDE.md)

### **Deployment**
- [🚀 Railway Deployment](docs/guides/RAILWAY_DEPLOYMENT.md)
- [🔒 Security Policy](SECURITY.md)

---

## 📈 **Market Impact**

*Illustrative framing — figures are directional estimates for the consulting work this replaces, not audited market data.*

**Problem We Solve:**
- **~$2.8B** estimated annual spend on demographic consulting
- **6,000+** hospitals needing demographic analysis
- **30,000+** senior care facilities planning expansion

**Our Solution:**
- **Fixed-price analysis** instead of an estimated $50K consulting project
- **Unlimited iterations** with conversational follow-up
- **Excel-ready output** with query metadata attached

---

## 🚀 **Get Involved**

### **For Healthcare Teams**

There is no subscription to buy. CensusChat has no billing, no signup, and no self-serve plan. Two things are real today:

1. **A delivered analysis.** Describe the question. Kevin Holland runs it and sends back the Excel-ready result. Fixed price, scoped and quoted before any work starts.
2. **Early access to the self-serve product.** Free while it is being built. You get the tool as it becomes usable, and your questions shape what ships next.

**[📧 Ask for an analysis or early access](mailto:kevin@kevintholland.com?subject=CensusChat%20Early%20Access)**

### **For Developers**
- Write quality TypeScript with comprehensive test coverage
- CI runs lint, typecheck, unit tests, Playwright e2e (`cd frontend && npm run test:e2e`), and Docker builds on every push
- Maintain the sub-2s query response-time target
- Follow privacy-first security practices (no PHI stored, audit logging, encryption at rest)
- Run `npm run secret-scan` before committing

---

**⭐ Star this repository if CensusChat helps your healthcare data work**

*US Census demographics, queried in plain English*

---

### 👤 **About Kevin Holland**

10+ years healthcare data experience • Frustrated by $50K consulting delays

**[📖 Read Kevin's Full Story](https://www.kevintholland.com)** | **[📧 Get Updates](mailto:kevin@kevintholland.com?subject=CensusChat%20Updates)**
