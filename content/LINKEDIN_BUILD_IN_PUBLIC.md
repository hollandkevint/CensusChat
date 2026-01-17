# LinkedIn Build-in-Public Post

## What Shipping 28,000 Lines of Production Code with Claude Code Taught Me About AI Pair Programming

---

### Hook (First 3 lines - visible before "see more")

I just shipped a production healthcare data platform using Claude Code as my pair programmer. 28,295 lines of TypeScript, 82% test coverage, SQL injection protection, and HIPAA-ready audit logging. In 6 weeks.

Here's what actually happened when I let AI write half my codebase.

---

### The Setup (Problem + Context)

Six weeks ago, I started building CensusChat - a natural language interface for US Census data aimed at healthcare strategy teams. The thesis: replace $50,000 demographic consulting engagements with a $297/month SaaS.

The tech stack choice was unusual: **DuckDB as an embedded OLAP database**, **Anthropic's Claude via Model Context Protocol**, and **Claude Code as my primary development tool**.

Everyone said embedded databases don't scale. Everyone said AI coding tools are just fancy autocomplete. Everyone said healthcare requires months of security review.

I decided to test all three assumptions simultaneously.

---

### What I Actually Built (The Numbers)

**Codebase Growth (Sept 1 - Oct 9, 2025)**
- 28,295 lines of production TypeScript added
- 121 files modified across backend/frontend
- 18 commits by me, 28 by Dependabot
- 82%+ test coverage maintained throughout

**Architecture Stack**
- Frontend: Next.js 15 + React 19 + Tailwind
- Backend: Node.js 20 + Express + TypeScript
- Data: DuckDB (embedded) + PostgreSQL + Redis
- AI: Claude Sonnet 4 via Model Context Protocol
- Tools: Claude Code for 60%+ of code generation

**What Actually Works**
- Sub-5 second query responses with full SQL validation
- 3,144 US counties loaded (real production data)
- True MCP protocol implementation (not just API wrapper)
- SQL injection protection via validation layer
- HIPAA-ready audit logging to `/backend/logs/sql-audit.log`
- Pre-commit hooks scanning for API key leaks

---

### The Claude Code Reality (Not What You Think)

I didn't just prompt "build me a healthcare platform" and ship the output.

**Here's what Claude Code actually did:**

1. **Wrote boilerplate I'd procrastinate on**
   - Test fixtures (480 lines of golden dataset tests)
   - SQL security policies (170 lines of validation rules)
   - Audit logging infrastructure (139 lines)
   - Error handling patterns across 121 files

2. **Caught my mistakes before they shipped**
   - SQL injection vulnerabilities in 3 different places
   - Race conditions in connection pooling logic
   - CORS misconfigurations that would break production
   - Missing error boundaries in React components

3. **Enforced consistency I'd abandon at 11pm**
   - TypeScript strict mode across entire codebase
   - Consistent naming conventions (no camelCase/snake_case mixing)
   - Proper async/await error handling
   - Documentation strings on every public method

**What Claude Code couldn't do:**
- Make product decisions (MCP vs REST API, embedded vs cloud DB)
- Design system architecture (I drew those diagrams)
- Understand my users (healthcare analysts, not developers)
- Prioritize features (that's still 100% human judgment)

---

### The DuckDB Decision (Why Embedded OLAP Wins)

Every SaaS playbook says: Use a cloud data warehouse. BigQuery, Snowflake, Redshift.

I went the opposite direction: **DuckDB embedded in my Node.js backend**.

**Why this "doesn't scale" approach actually does:**

**Latency**
- No network hop to warehouse: ~50-100ms saved per query
- Connection pooling within same process: ~20ms saved
- Result: Sub-5 second responses with full SQL validation

**Cost**
- No per-query warehouse pricing
- No egress fees for result sets
- Just EC2/Railway compute: ~$50/month vs ~$500-1000/month
- Better unit economics for early-stage SaaS

**Simplicity**
- One codebase, one deployment
- No credential management for separate warehouse
- Test with same DB engine as production (not SQLite mocks)
- Connection pooling logic lives in my code

**When embedded OLAP breaks down:**
- >100GB data (I'm at 1.5MB)
- >50 concurrent queries (I'm at <10)
- Multi-tenant isolation requirements
- Need for BI tool integrations

For a bootstrap SaaS serving healthcare analysts? Embedded wins.

---

### The MCP Insight (Security-First Text-to-SQL)

The scary part of GenAI text-to-SQL: You're letting Claude write SQL that runs on your production database.

**What could go wrong:**
```sql
-- User asks: "Show me all counties"
-- Bad AI generates:
SELECT * FROM county_data; DROP TABLE county_data; --
```

**The MCP protocol layer I built:**
1. Claude generates SQL from natural language
2. MCP validation layer intercepts
3. SQL parser checks:
   - Only SELECT statements (no DROP, DELETE, UPDATE)
   - Table allowlist (county_data only)
   - Column validation against schema
   - Row limit enforcement (1,000 max)
   - Comment pattern blocking
4. Audit logger records query + validation result
5. DuckDB executes only if validation passes

**Result:**
- 58 California county queries: 100% validation pass rate
- 47 counties >1M population: 100% pass rate
- SQL injection attempts: 0 succeeded (blocked at validation)
- Audit trail: Every query logged with timestamp, validation status, execution time

This is the difference between a demo and a product you can sell to hospitals.

---

### What I'd Do Differently

**Overengineered Too Early**
- Built comprehensive MCP server with 3 tools, 2 resources
- Could've shipped with just SQL validation layer
- Spent 2 days on audit logging that no customer has asked for yet

**Underestimated Frontend Complexity**
- Backend took 3 weeks, frontend took 3 weeks
- React 19 + Next.js 15 adoption was bleeding-edge pain
- Should've stuck with stable versions for MVP

**Should've Build-in-Public Earlier**
- Waited until "production ready" to share
- Could've gotten feedback after week 2
- Lost potential early users who would've shaped product

---

### The Controversial Take

**AI coding tools are not about speed. They're about consistency.**

I didn't ship 28,000 lines faster than I could've hand-coded them. I shipped 28,000 lines where every error case is handled, every function is documented, and every test passes.

That's not possible at 11pm on your 14th straight day of coding. But it is possible when Claude Code is checking your work.

The future isn't "AI replaces developers." It's "AI makes good developers maintain senior-level consistency across their entire codebase."

---

### The Numbers That Matter

**What I built:**
- Healthcare demographics SaaS replacing $50K consulting
- 28,295 lines of production TypeScript
- 82%+ test coverage, SQL injection protection, audit logging
- Built with Claude Code in 6 weeks

**What I learned:**
- Embedded OLAP (DuckDB) beats cloud warehouses for bootstrap SaaS
- MCP protocol layer is mandatory for production text-to-SQL
- Claude Code enforces consistency, not just speed
- Build-in-public early, not after "production ready"

**What's next:**
- Open-sourcing the entire codebase (after revoking API keys)
- 15-minute fork setup for anyone who wants to run their own
- Writing detailed architecture guide on MCP + DuckDB + Claude Code

---

### The Ask

If you're building with:
- GenAI text-to-SQL (how are you handling validation?)
- Embedded databases (what's your scale threshold?)
- Claude Code (what % of your code is AI-generated?)

I want to compare notes. Drop a comment or DM.

And if you're in healthcare strategy and spend >$10K/year on demographic consulting, I have 3 beta slots open. Let me show you how this works.

---

**Code:** https://github.com/hollandkevint/CensusChat (making public next week)
**Built with:** Claude Code, DuckDB, MCP, TypeScript, Next.js
**Timeline:** Sept 1 - Oct 9, 2025 (6 weeks)
**LOC:** 28,295 lines added, 82%+ test coverage

---

### Alternative Hooks (A/B Test Ideas)

**Hook Option 1 (Contrarian):**
"Everyone said embedded databases don't scale. I built a healthcare SaaS on DuckDB anyway. Here's what happened."

**Hook Option 2 (Vulnerable):**
"I let AI write 60% of my production codebase. It caught 3 SQL injection bugs I missed. Here's the reality of AI pair programming."

**Hook Option 3 (Numbers):**
"28,295 lines of TypeScript. 6 weeks. One developer. Claude Code as my pair programmer. What shipping a production SaaS with AI actually looks like."

**Hook Option 4 (Problem-first):**
"Healthcare teams pay $50,000 for demographic reports that take 6 weeks. I built a SaaS that delivers them in 6 seconds. Tech stack: DuckDB + Claude + MCP."

---

### Engagement Strategy

**Best posting times:**
- Tuesday/Wednesday 7-9am ET (healthcare decision-makers)
- Thursday 12-2pm ET (tech community lunch browsing)

**Carousel option:**
Break into 10 slides:
1. Hook + thesis
2. The numbers (LOC, timeline, coverage)
3. Why embedded OLAP
4. The MCP security layer
5. What Claude Code actually does
6. What I overengineered
7. The controversial take
8. Results that matter
9. What's next
10. The ask

**Comment strategy:**
Engage with every comment in first 2 hours (algorithm boost)
Share specific code examples if people ask
Offer to share architecture diagrams via DM

---

### Tags

#BuildInPublic #AIEngineering #HealthTech #DuckDB #ClaudeAI #ModelContextProtocol #TextToSQL #TypeScript #SaaS #HealthcareData

---

**Length:** ~1,450 words
**Read time:** 5-6 minutes
**Target:** Technical founders, AI engineers, healthcare data leaders
**CTA:** Comments + DMs + Beta slots
