# CensusChat Documentation

**Healthcare Demographics Platform with Marketing Analytics**

This documentation provides everything you need to understand, deploy, and use CensusChat - a natural language interface to U.S. Census data powered by Claude AI and DuckDB.

---

## 🚀 Quick Start

**New to CensusChat?** Start here:

1. **[Quick Start Guide](QUICK_START_EXPANDED.md)** - Get up and running in 30 minutes
2. **[API Key Setup](API_KEY_SETUP.md)** - Configure Census API and Anthropic keys
3. **[Marketing Analytics Guide](MARKETING_ANALYTICS_EXPANSION.md)** - Learn about 84 variables and 4 geography levels

---

## 📚 Documentation Index

### Getting Started

| Document | Description | Audience |
|----------|-------------|----------|
| **[Quick Start](QUICK_START_EXPANDED.md)** | Setup and first queries | Everyone |
| **[API Key Setup](API_KEY_SETUP.md)** | Environment configuration | Developers |
| **[Marketing Analytics](MARKETING_ANALYTICS_EXPANSION.md)** | 84 variables, 4 geo levels | Data Analysts |
| **[Docker Troubleshooting](DOCKER_TROUBLESHOOTING.md)** | Common Docker issues | DevOps |

### Architecture & Design

| Document | Description |
|----------|-------------|
| **[System Architecture](architecture/01-system-architecture.md)** | High-level system design |
| **[Data Architecture](architecture/03-data-architecture.md)** | Database schema and design |
| **[Security Architecture](architecture/04-security-architecture.md)** | Security and compliance |
| **[Backend Structure](BACKEND_STRUCTURE.md)** | Backend codebase overview |
| **[Frontend Architecture](FRONTEND_ARCHITECTURE.md)** | React frontend design |

### API & Integration

| Document | Description |
|----------|-------------|
| **[MCP API Documentation](api/MCP_API_DOCUMENTATION.md)** | Model Context Protocol API |
| **[MCP Schema Update](api/MCP_SCHEMA_UPDATE_OCT_2025.md)** | Latest schema (84 vars, 4 levels) |
| **[API Integration Guide](API_INTEGRATION_GUIDE.md)** | Integration patterns |
| **[Deployment Guide](api/DEPLOYMENT_GUIDE.md)** | Production deployment |

### Data & Development

| Document | Description |
|----------|-------------|
| **[ACS Data Loading](guides/ACS_DATA_LOADING.md)** | Census API data loading |
| **[Block Group Variables](guides/BLOCK_GROUP_VARIABLES.md)** | Detailed variable reference |
| **[Railway Deployment](guides/RAILWAY_DEPLOYMENT.md)** | Deploy to Railway |
| **[Testing Guide](testing/TESTING_GUIDE.md)** | Testing infrastructure |
| **[Testing Infrastructure](testing/TESTING_INFRASTRUCTURE.md)** | Test architecture |

### Reference

| Document | Description |
|----------|-------------|
| **[DuckDB Core Functions](references/duckdb/core-functions.md)** | DuckDB SQL reference |
| **[Healthcare SQL Patterns](references/duckdb/healthcare-sql-patterns.md)** | Healthcare-specific queries |
| **[Performance Optimization](references/duckdb/performance-optimization.md)** | Query optimization |
| **[MCP Server Functions](references/duckdb-mcp/server-functions.md)** | MCP server reference |

### Implementation Details

| Document | Description |
|----------|-------------|
| **[MCP Implementation](implementation/MCP_IMPLEMENTATION_SUMMARY.md)** | MCP server implementation |
| **[Data Loading System](implementation/DATA_LOADING_SYSTEM.md)** | Data pipeline architecture |
| **[Implementation Summary](implementation/IMPLEMENTATION_SUMMARY.md)** | Technical implementation |
| **[Documentation Status](DOCUMENTATION_STATUS.md)** | Current doc status |

### Project Management

| Document | Description |
|----------|-------------|
| **[Epic 2: MCP Integration](epics/epic-2-duckdb-mcp-integration.md)** | MCP server implementation |
| **[Epic 3: Marketing Analytics](epics/epic-3-marketing-analytics-expansion.md)** | 84-variable expansion |
| **[MVP Status](project-management/MVP_STATUS.md)** | Current project status |
| **[Feature Roadmap](project-management/FEATURE_ROADMAP.md)** | Planned features |
| **[Success Metrics](project-management/SUCCESS_METRICS.md)** | KPIs and metrics |
| **[Product Requirements](project-management/prd.md)** | PRD document |
| **[User Personas](project-management/USER_PERSONAS.md)** | Target users |

### Session Notes

| Document | Description |
|----------|-------------|
| **[Oct 6, 2025 - Expansion](sessions/SESSION_OCT_6_2025_EXPANSION.md)** | Marketing analytics expansion |
| **[Oct 2025 Summary](sessions/SESSION_SUMMARY_OCT_2025.md)** | Monthly summary |
| **[Final Status](sessions/FINAL_STATUS.md)** | Latest status |

---

## 🗂️ Folder Structure

```
docs/
├── README.md                          # This file - documentation index
├── QUICK_START_EXPANDED.md           # Main quick start guide
├── MARKETING_ANALYTICS_EXPANSION.md  # 84 variables, 4 geo levels guide
│
├── api/                               # API documentation
│   ├── MCP_API_DOCUMENTATION.md
│   ├── MCP_SCHEMA_UPDATE_OCT_2025.md
│   └── DEPLOYMENT_GUIDE.md
│
├── architecture/                      # Architecture docs
│   ├── 01-system-architecture.md
│   ├── 03-data-architecture.md
│   └── 04-security-architecture.md
│
├── guides/                            # How-to guides
│   ├── ACS_DATA_LOADING.md
│   ├── BLOCK_GROUP_VARIABLES.md
│   └── RAILWAY_DEPLOYMENT.md
│
├── references/                        # Technical references
│   ├── duckdb/                        # DuckDB SQL patterns
│   └── duckdb-mcp/                    # MCP integration patterns
│
├── epics/                             # Epic documentation
│   ├── epic-2-duckdb-mcp-integration.md
│   └── epic-3-marketing-analytics-expansion.md
│
├── implementation/                    # Implementation details
│   ├── MCP_IMPLEMENTATION_SUMMARY.md
│   ├── DATA_LOADING_SYSTEM.md
│   └── IMPLEMENTATION_SUMMARY.md
│
├── project-management/                # PM docs
│   ├── MVP_STATUS.md
│   ├── FEATURE_ROADMAP.md
│   ├── SUCCESS_METRICS.md
│   ├── prd.md
│   └── USER_PERSONAS.md
│
├── testing/                           # Testing documentation
│   ├── TESTING_GUIDE.md
│   └── TESTING_INFRASTRUCTURE.md
│
├── sessions/                          # Session summaries
│   ├── SESSION_OCT_6_2025_EXPANSION.md
│   └── SESSION_SUMMARY_OCT_2025.md
│
└── archive/                           # Archived/legacy docs
    ├── legacy-docs/                   # Old implementation docs
    └── old-planning/                  # Brainstorming, old plans
```

---

## 🎯 Common Use Cases

### I want to...

**Get started quickly**
→ Read [Quick Start Guide](QUICK_START_EXPANDED.md)

**Understand the data**
→ Read [Marketing Analytics Guide](MARKETING_ANALYTICS_EXPANSION.md)

**Deploy to production**
→ Read [Deployment Guide](api/DEPLOYMENT_GUIDE.md)

**Integrate with the API**
→ Read [MCP API Documentation](api/MCP_API_DOCUMENTATION.md)

**Optimize queries**
→ Read [Performance Optimization](references/duckdb/performance-optimization.md)

**Load new data**
→ Read [ACS Data Loading](guides/ACS_DATA_LOADING.md)

**Contribute code**
→ Read [Git Branching Strategy](contributing/git-branching-strategy.md)

**Understand architecture**
→ Read [System Architecture](architecture/01-system-architecture.md)

---

## 📊 Key Features

### 84 Variables Across 10 Categories
- **Demographics** (16): Population, age, race/ethnicity
- **Economics** (16): Income distribution, poverty
- **Education** (5): Attainment levels
- **Housing** (10): Units, value, burden
- **Technology** (6): Broadband, digital access
- **Transportation** (10): Commute patterns, WFH
- **Occupation** (5): Industry sectors
- **Healthcare** (8): Insurance, disability
- **Language** (3): Limited English proficiency
- **Family** (5): Structure, isolation

### 4-Level Geographic Hierarchy
- **State** (52): State-level analysis
- **County** (3,144): Regional targeting
- **Tract** (84,400): Neighborhood analysis
- **Block Group** (239,741): Micro-targeting

### 327,337 Total Geographies
All with complete demographic data and parent-child relationships

---

## 🔗 External Resources

- **GitHub Repository**: https://github.com/hollandkevint/CensusChat
- **Census API**: https://www.census.gov/data/developers/data-sets.html
- **Claude AI**: https://www.anthropic.com/claude
- **DuckDB**: https://duckdb.org/docs/

---

## 📝 Documentation Standards

All documentation follows these principles:

1. **Clear Navigation**: Every doc has a clear purpose and audience
2. **Consistent Structure**: Headers, tables, code blocks follow standards
3. **Up-to-Date**: Docs reflect current implementation (Oct 2025)
4. **Cross-Referenced**: Links between related docs
5. **Practical**: Real examples and use cases

---

## 🆘 Support

**Issues & Questions**:
- Check [Docker Troubleshooting](DOCKER_TROUBLESHOOTING.md) for common issues
- Review [Session Notes](sessions/) for recent changes
- See [Epic Documentation](epics/) for feature details

**Contributing**:
- See [Git Branching Strategy](contributing/git-branching-strategy.md)
- Follow [Commit Sequence Examples](contributing/commit-sequence-examples.md)

---

**Last Updated**: October 6, 2025
**Current Version**: 2.0 (Marketing Analytics Expansion)
**Status**: ✅ Production Ready
