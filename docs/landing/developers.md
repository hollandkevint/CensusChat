# Healthcare Data Engineers: Stop Fighting Census APIs

## The Technical Problem You Know Too Well

You've been asked to "just pull some Census data" and discovered:
- 🔥 Complex Census API with 40,000+ variables  
- 📚 300-page documentation that assumes PhD-level statistics knowledge
- 🐛 Inconsistent data formats and missing error handling
- ⚡ Query performance issues with large datasets
- 🔐 Security concerns with raw API access

**I solved this. Here's how.**

---

## Technical Architecture Deep Dive

### MCP + Claude Integration
```typescript
// Natural language → SQL validation → Census API
const pipeline = {
  step1: "Claude Sonnet 4 translates to SQL",
  step2: "MCP validates query for security + performance", 
  step3: "DuckDB executes the query against pre-loaded ACS data",
  step4: "Results formatted with query metadata",
  step5: "Excel-ready results, exportable to Excel/CSV/PDF"
};
```

### Engineering Targets and Constraints
- **Sub-2 Second Queries**: the response-time target contributors maintain
- **30-Second Request Timeout**: enforced in `backend/src/routes/query.routes.ts`, covering MCP validation and the Anthropic API round trip
- **1,000-Row Query Limit**: enforced by the SQL validation layer
- **Redis Caching**: demographic query results cached via `backend/src/services/cacheService.ts`
- **ARM64 Compatible**: builds on Apple Silicon

### Service Virtualization (Complete API Mocking)
```bash
# One command deploys testing environment
./test-runner.sh

# Results: WireMock Census API + PostgreSQL + Redis + DuckDB
✅ WireMock Census API fixtures
✅ Offline development against seeded data
```

---

## Why This Matters for Your Stack

**Integration:**
- RESTful API over Express 5
- MCP HTTP transport for external clients (Claude Desktop, Postman)
- Excel, CSV, and PDF export endpoints
- Privacy-first architecture: no PHI stored, audit logging, encryption at rest

**Developer Experience:**
- TypeScript throughout (strict mode)
- Docker Compose for local setup
- Jest + Supertest backend suite, Playwright e2e on the frontend

**Containerization:**
- Docker Compose stack: backend, frontend, PostgreSQL, Redis
- Dockerfiles build in CI on every push
- Next.js standalone output for a slim frontend image

---

## Code Deep Dive

**Repository:** [github.com/hollandkevint/CensusChat](https://github.com/hollandkevint/CensusChat)

**Key Technical Docs:**
- [API Integration Guide](../API_INTEGRATION_GUIDE.md) - MCP layer architecture
- [Frontend Architecture](../FRONTEND_ARCHITECTURE.md) - Next.js 15 + React 19

**CI:** [GitHub Actions](https://github.com/hollandkevint/CensusChat/actions) runs lint, typecheck, unit tests, Playwright e2e, and Docker builds on every push.

---

## Connect with the Builder

**I'm Kevin Holland** - 10+ years healthcare data engineering, frustrated by Census API complexity.

**This stack:**
- Node.js 20 + TypeScript + Express 5
- PostgreSQL 15 + Redis 7 + DuckDB 1.4.3
- Claude Sonnet 4 + Agent SDK + MCP SDK
- Next.js 15 + React 19 + Tailwind CSS 4

**[🔧 Fork the Code →](https://github.com/hollandkevint/CensusChat)**  
**[💬 Technical Discussion →](https://github.com/hollandkevint/CensusChat/discussions)**  
**[📧 Architecture Questions →](mailto:kevin@kevintholland.com?subject=CensusChat%20Technical%20Discussion)**
