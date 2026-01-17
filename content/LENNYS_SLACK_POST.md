# Lenny's Newsletter Slack - Build-in-Public Update

## Channel: #build-in-public or #saas-builders

---

### Post Content

Hey Lenny community 👋

**Sharing a 6-week build-in-public journey**: Healthcare SaaS replacing $50K consulting with $297/month queries.

**The product:** Natural language interface for US Census demographics. Healthcare strategy teams ask questions like "Medicare seniors in Tampa with $75K+ income" and get instant Excel exports instead of waiting 6 weeks for a consultant report.

**The controversial tech choices:**
- DuckDB (embedded OLAP) instead of Snowflake/BigQuery
- Claude Code wrote ~60% of the 28K lines of production TypeScript
- MCP protocol layer for SQL validation (critical for GenAI text-to-SQL)

**What actually worked:**
- Embedded database = $50/month compute vs $500-1000/month warehouse
- Sub-5 second query responses with full security validation
- 82% test coverage maintained with AI pair programming
- HIPAA-ready audit logging from day 1

**What I'd do differently:**
- Started sharing at week 2, not week 6
- Stuck with stable Next.js version (not bleeding-edge 15)
- Skipped some audit logging that no customer asked for yet

**The insight I'm still processing:**
AI coding tools aren't about speed - they're about **consistency**. Claude Code doesn't make me ship faster. It makes me maintain senior-level error handling across my entire codebase at 11pm.

**Current state:**
- 3,144 US counties loaded (production data)
- Open-sourcing next week after API key cleanup
- 3 beta slots open for healthcare teams

**Questions for the group:**

1. **Embedded vs cloud data warehouse** - what's your threshold? I'm at 1.5MB data, <10 concurrent users. When would you switch?

2. **AI-generated code in production** - what % of your SaaS is AI-written? How do you handle code reviews?

3. **Healthcare SaaS founders** - how long did HIPAA compliance take? I built audit logging from day 1 and might be overengineered.

**Metrics I'm tracking:**
- Query response time: <5 sec (target hit ✅)
- Unit economics: $50/month infrastructure for unlimited queries
- Code quality: 82% test coverage, 0 SQL injection vulnerabilities
- Time to beta: 6 weeks (probably could've been 4)

Anyone else building with embedded databases or GenAI text-to-SQL? Would love to compare notes.

**GitHub:** https://github.com/hollandkevint/CensusChat (public next week)
**Tech stack:** TypeScript, Next.js, DuckDB, Claude via MCP
**Timeline:** Sept 1 - Oct 9 (6 weeks, solo founder)

---

### Thread Follow-ups (Copy/Paste Responses)

**If someone asks about DuckDB:**
```
DuckDB trade-offs vs cloud warehouse:

WINS:
- Zero network latency (~50-100ms saved per query)
- No per-query pricing - just EC2 compute
- Test with same DB as prod (not SQLite mocks)
- Connection pooling in same process

LOSES:
- Scale ceiling ~100GB (I'm at 1.5MB)
- No BI tool integrations (Tableau, etc)
- Concurrent query limit ~50 (I'm at <10)

For bootstrap SaaS? Embedded wins on cost + latency.
For enterprise product? Switch at ~10GB or need BI tools.

My switch threshold: When I hit 50 concurrent users or need Tableau.
```

**If someone asks about Claude Code:**
```
Claude Code reality check:

WHAT IT DOES:
- Boilerplate I'd procrastinate (tests, error handling, docs)
- Consistency across 121 files (naming, patterns, types)
- Catches bugs in real-time (SQL injection, race conditions)

WHAT IT DOESN'T:
- Product decisions (MCP vs REST)
- Architecture design (I draw those diagrams)
- Feature prioritization (that's human judgment)

I estimate ~60% of lines are AI-generated.
~90% of those lines needed human review/editing.

The win: Every function has docs, tests, error handling.
That's not happening at 11pm without AI checking my work.
```

**If someone asks about pricing/monetization:**
```
Pricing strategy still evolving:

TARGET: Healthcare strategy teams at hospitals/MA plans
WILLINGNESS TO PAY: $50K for 6-week consultant report
MY PRICING: $297/month for unlimited queries

UNIT ECONOMICS:
- Infrastructure: $50/month (Railway + SendGrid)
- CAC target: <$500 (outbound to 25 healthcare orgs)
- LTV target: $3,564 (12 months @ $297/month)
- Margin: 83% (SaaS should be 80%+)

VALIDATION PLAN:
- 3 beta customers @ $0 (feedback + case studies)
- Next 10 @ $297/month (price anchoring)
- Next 50 @ $497/month (if retention >70%)

Still very early. Would love feedback on pricing psychology here.
```

---

### Engagement Tips

**Best time to post:**
- Monday/Tuesday 8-10am PT (Lenny community is West Coast heavy)
- Avoid Friday afternoons (lower engagement)

**Follow-up strategy:**
- Check thread every 2-3 hours for first day
- Give detailed responses (not just "thanks!")
- Share code snippets if people ask
- Offer to DM architecture diagrams

**Cross-promotion:**
- Reference this in LinkedIn post ("also sharing in Lenny's Slack")
- Tag @lennysan if he engages (don't cold-tag)

---

### Alternative Versions

**Version 2 (More vulnerable/personal):**
"6 weeks ago I quit my job to build a healthcare SaaS. Today I'm at 28K lines of code, 0 customers, and questioning every tech choice I made. Here's what I learned about AI pair programming, embedded databases, and building in public..."

**Version 3 (More data-driven):**
"EXPERIMENT: Can one developer ship a production healthcare SaaS in 6 weeks using Claude Code?

RESULT: 28,295 lines of TypeScript, 82% test coverage, SQL injection protection, and HIPAA-ready logging.

Here's the build breakdown 🧵"

---

**Length:** ~550 words
**Target:** SaaS founders, technical product builders
**Tone:** Conversational, specific numbers, open to feedback
**CTA:** Questions + engagement + comparing notes
