# CensusChat - Natural Language Census Data Query Platform

**Status:** Phase 3 - MVP Development  
**Methodology:** BMAD B2B Data Products Framework  
**License:** MIT

## Overview

CensusChat is an open-source platform that democratizes access to US Census data through natural language queries. By combining Census API data with DuckDB performance optimization and Model Context Protocol (MCP), users can explore demographic insights using plain English instead of complex SQL or API calls.

## Problem Statement

US Census data contains invaluable insights for researchers, analysts, journalists, and policy makers, but accessing and querying this data requires deep technical knowledge of Census APIs, complex data structures, and SQL. This barrier prevents many potential users from leveraging this public resource for data-driven decision making.

## Target Users

- **Primary:** Data analysts, researchers (academic, policy, journalism), civic technologists
- **Secondary:** Students, small government agencies, non-profit organizations
- **Market Size:** ~560K potential users across data professionals, researchers, and journalists

## Key Features

### Core Capabilities
- **Natural Language Queries**: Ask questions in plain English, get Census data insights
- **High Performance**: Sub-second responses on 11M+ census records via DuckDB optimization  
- **Comprehensive Data**: Access to US Census ACS 5-year detailed tables (250+ tables, 10K+ variables)
- **Security First**: SQL validation restricts queries to SELECT statements only
- **Open Source**: Community-driven development and transparent operations

### Technical Stack
- **Data Processing**: DuckDB for high-performance analytical queries
- **API Integration**: US Census API for ACS 5-year detailed tables
- **Natural Language Interface**: Model Context Protocol (MCP) implementation
- **Query Validation**: SQL parser for security and safety
- **Caching Layer**: Redis for frequently accessed queries
- **Web Interface**: React/Next.js for user dashboard

## Business Model

### Revenue Streams
1. **Freemium SaaS**: Basic queries free, advanced features paid ($9-49/month)
2. **Usage-based API**: Pay-per-query for developers ($0.01-0.10 per query)
3. **Enterprise Licensing**: Custom deployments ($10K-100K annually)
4. **Training/Consulting**: Data analysis training and research projects ($150-300/hour)

### Pricing Strategy
- **Free Tier**: 100 queries/month
- **Pro Tier**: $19/month for 10K queries + advanced features
- **Enterprise**: Custom pricing starting at $500/month

## Development Methodology

This project follows the **BMAD B2B Data Products Framework**, ensuring systematic development from concept to market with focus on:

- Data asset value optimization
- Service layer design for user success
- Platform capabilities for scale
- Trust and security frameworks
- Ecosystem development for growth

### BMAD Project Structure
```
bmad-project/
├── agents/          # Configured BMAD agents for specialized tasks
├── tasks/           # Executed task workflows and results
├── workflows/       # Custom CensusChat development workflows  
├── templates/       # Generated documents and specifications
└── decisions/       # Architectural and business decisions
```

## Quick Start

### 🚀 Using Docker (Recommended)

```bash
# Clone repository
git clone https://github.com/[username]/CensusChat.git
cd CensusChat

# Copy environment files
cp backend/.env.example backend/.env

# Start development environment
make dev
# or
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Access applications
# Frontend: http://localhost:3000
# Backend API: http://localhost:3001/api/v1
# API Health: http://localhost:3001/health
```

### 💻 Local Development

```bash
# Backend (Terminal 1)
cd backend
npm install
npm run dev

# Frontend (Terminal 2)
cd frontend
npm install
npm run dev
```

### 🛠️ Available Commands

```bash
make help          # Show all available commands
make dev           # Start development environment
make build         # Build production images
make test          # Run all tests
make lint          # Run linters
make logs          # Show container logs
```

### For Contributors
1. Review our [Contributing Guidelines](docs/CONTRIBUTING.md)
2. Check open issues and project roadmap
3. Join our community discussions
4. Submit pull requests following our standards

## Project Status

### Completed ✅
- [x] Phase 1: Market research and competitive analysis
- [x] Phase 2: Technical feasibility validation with DuckDB + Census data
- [x] Phase 2: Business model and pricing strategy
- [x] Phase 2: BMAD methodology setup and agent configuration
- [x] Phase 3: Backend API server setup (Express, TypeScript, DuckDB)
- [x] Phase 3: Frontend application setup (Next.js 14+, React 19, Tailwind)
- [x] Phase 3: Docker containerization and orchestration
- [x] Phase 3: CI/CD pipeline with GitHub Actions

### In Progress 🚧
- [ ] Phase 3: Natural Language Processing (NLP) service implementation
- [ ] Phase 3: Census data ingestion pipeline
- [ ] Phase 3: Query interface and visualization components
- [ ] Phase 3: Authentication and user management

### Upcoming 📋
- [ ] Phase 4: Beta testing with initial users
- [ ] Phase 4: Performance optimization and caching
- [ ] Phase 5: Open source community launch
- [ ] Phase 5: Enterprise features and scaling

## Documentation

- [Technical Architecture](docs/architecture.md)
- [API Documentation](docs/api.md)
- [User Guide](docs/user-guide.md)
- [Developer Guide](docs/developer-guide.md)
- [BMAD Methodology](bmad-project/README.md)

## Community

- **GitHub Discussions**: [Project discussions and Q&A]
- **Discord**: [Real-time community chat] (coming soon)
- **Twitter**: [@CensusChat] (coming soon)
- **Blog**: [Technical insights and tutorials] (coming soon)

## Contributing

We welcome contributions from the community! Please see our [Contributing Guidelines](docs/CONTRIBUTING.md) for details on:

- Code of conduct
- Development workflow
- Testing requirements
- Documentation standards
- Community guidelines

## License

[License details to be determined - likely MIT or Apache 2.0]

## Acknowledgments

- US Census Bureau for providing open access to demographic data
- DuckDB team for high-performance analytical database
- Model Context Protocol community for natural language interface standards
- BMAD Method framework for systematic B2B data product development

---

**Built with the BMAD B2B Data Products Framework**  
*Systematic development for data-driven business success*