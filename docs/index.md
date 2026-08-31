# CensusChat Documentation

Natural language queries over US Census demographics, for healthcare strategy teams.

Pick the path that matches what you came for.

---

## I want to run it

| Step | Document |
|------|----------|
| 1. Get it running locally | [Quick Start](https://github.com/hollandkevint/CensusChat/blob/main/QUICK_START.md) |
| 2. Configure API keys (Anthropic + Census) | [API Key Setup](https://github.com/hollandkevint/CensusChat/blob/main/API_KEY_SETUP.md) |
| 3. Load the full dataset (states → block groups) | [Quick Start: Expanded Data](QUICK_START_EXPANDED.md) |
| 4. Load ACS data directly from the Census API | [ACS Data Loading](guides/ACS_DATA_LOADING.md) |
| Docker will not start | [Docker Troubleshooting](DOCKER_TROUBLESHOOTING.md) |
| Deploy to Railway | [Railway Deployment](guides/RAILWAY_DEPLOYMENT.md) |
| Deploy to production generally | [Deployment Guide](api/DEPLOYMENT_GUIDE.md) |

The Census API key is optional but raises the rate limit. Its own setup notes:
[Census API Key Setup](CENSUS_API_KEY_SETUP.md).

---

## I want to understand the architecture

| Question | Document |
|----------|----------|
| What is the system, end to end? | [Architecture Overview](architecture/00-overview.md) |
| How do the services fit together? | [System Architecture](architecture/01-system-architecture.md) |
| What is the data model? | [Data Architecture](architecture/03-data-architecture.md) |
| How is SQL kept safe? | [Security Architecture](architecture/04-security-architecture.md) |
| What runs where? | [Infrastructure Architecture](architecture/05-infrastructure-architecture.md) |
| How is the backend laid out? | [Backend Structure](BACKEND_STRUCTURE.md) |
| How is the frontend laid out? | [Frontend Architecture](FRONTEND_ARCHITECTURE.md) |
| What variables and geographies exist? | [Marketing Analytics Expansion](MARKETING_ANALYTICS_EXPANSION.md) |
| What do the block-group columns mean? | [Block Group Variables](guides/BLOCK_GROUP_VARIABLES.md) |

Deeper reference material: [DuckDB and MCP references](references/README.md).

---

## I want the API

| Topic | Document |
|-------|----------|
| Endpoint reference | [API Overview](api/README.md) |
| MCP tools and protocol | [MCP API Documentation](api/MCP_API_DOCUMENTATION.md) |
| Current MCP schema | [MCP Schema Update](api/MCP_SCHEMA_UPDATE_OCT_2025.md) |
| Run the MCP server over stdio | [MCP stdio Setup](guides/MCP_STDIO_SETUP.md) |
| Build against the FDB MCP layer | [FDB MCP Developer Guide](api/FDB_MCP_DEVELOPER_GUIDE.md) |
| Request/response flow and validation | [API Integration Guide](API_INTEGRATION_GUIDE.md) |
| How MCP is implemented | [MCP Implementation Summary](implementation/MCP_IMPLEMENTATION_SUMMARY.md) |

---

## I want to contribute

| Topic | Document |
|-------|----------|
| Contribution process and standards | [CONTRIBUTING.md](https://github.com/hollandkevint/CensusChat/blob/main/CONTRIBUTING.md) |
| Branching strategy | [Git Branching Strategy](contributing/git-branching-strategy.md) |
| Commit conventions | [Commit Sequence Examples](contributing/commit-sequence-examples.md) |
| Running the test suite | [Testing Guide](testing/TESTING_GUIDE.md) |
| How the tests are built | [Testing Infrastructure](testing/TESTING_INFRASTRUCTURE.md) |
| Repo conventions for AI agents | [CLAUDE.md](https://github.com/hollandkevint/CensusChat/blob/main/CLAUDE.md) |
| Reporting a vulnerability | [SECURITY.md](https://github.com/hollandkevint/CensusChat/blob/main/SECURITY.md) |
| Release history | [CHANGELOG.md](https://github.com/hollandkevint/CensusChat/blob/main/CHANGELOG.md) |

Data-pipeline internals, if you are changing the loaders:
[Data Loading System](implementation/DATA_LOADING_SYSTEM.md) and
[Implementation Summary](implementation/IMPLEMENTATION_SUMMARY.md).

---

## Not part of the published docs

These stay in the repository for history. They are excluded from the published site
and are not maintained as current documentation.

- [`internal/`](https://github.com/hollandkevint/CensusChat/tree/main/docs/internal) — session notes, epic planning, documentation-status snapshots
- [`plans/`](https://github.com/hollandkevint/CensusChat/tree/main/docs/plans) — in-flight implementation plans
- [`archive/`](https://github.com/hollandkevint/CensusChat/tree/main/docs/archive) — superseded documents, kept for the record
- [`project-management/`](https://github.com/hollandkevint/CensusChat/tree/main/docs/project-management) — roadmap, personas, PRD, MVP status.
  Some of it is dated; read it as project history, not as a description of the current build.
