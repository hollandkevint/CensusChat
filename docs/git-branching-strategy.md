# CensusChat Git Branching Strategy

## Overview

This document defines the git branching strategy for CensusChat that aligns with the BMAD B2B Data Products methodology. Our approach supports systematic development through data asset assessment, service layer design, platform development, and ecosystem growth phases.

## Core Branching Model

### Main Branches

```
main (production-ready code)
├── develop (integration branch for ongoing development)
├── release/v* (release preparation branches)
└── hotfix/* (critical production fixes)
```

### BMAD Phase Branches

Each BMAD phase has dedicated long-running branches that merge into develop:

```
develop
├── phase/data-asset-assessment (Week 1-2)
├── phase/service-layer-design (Week 3-4)  
├── phase/platform-development (Month 2-3)
└── phase/ecosystem-growth (Month 4+)
```

### Feature Branch Structure

Feature branches follow BMAD agent ownership patterns:

```
feature/[agent-type]/[bmad-phase]/[specific-feature]

Examples:
feature/data-product-strategist/data-asset/market-analysis
feature/data-ops-engineer/platform-dev/duckdb-optimization
feature/data-services-designer/service-layer/training-modules
feature/data-ecosystem-builder/ecosystem-growth/partner-integrations
```

## Branch Naming Conventions

### Phase Branches
- `phase/data-asset-assessment` - Weeks 1-2: Market validation, data value assessment
- `phase/service-layer-design` - Weeks 3-4: Service catalog, community strategy
- `phase/platform-development` - Months 2-3: MVP development, architecture implementation
- `phase/ecosystem-growth` - Month 4+: Partnerships, scaling, optimization

### Feature Branches
Format: `feature/[agent]/[phase-short]/[feature-name]`

**Agent Prefixes:**
- `dps` - data-product-strategist
- `dva` - data-value-analyst  
- `dma` - data-monetization-architect
- `doe` - data-ops-engineer
- `dts` - data-trust-specialist
- `dsd` - data-services-designer
- `deb` - data-ecosystem-builder
- `dcl` - data-commercial-lead

**Phase Codes:**
- `asset` - data-asset-assessment
- `service` - service-layer-design
- `platform` - platform-development
- `ecosystem` - ecosystem-growth

**Examples:**
```
feature/dps/asset/competitive-analysis
feature/doe/platform/census-api-integration
feature/dsd/service/training-curriculum
feature/deb/ecosystem/github-community-setup
```

### Support Branches
- `bugfix/[issue-number]-[description]` - Non-critical bug fixes
- `hotfix/[issue-number]-[description]` - Critical production fixes
- `docs/[section]-[topic]` - Documentation updates
- `chore/[maintenance-task]` - Maintenance and refactoring

## Workflow by BMAD Phase

### Phase 1: Data Asset Assessment (Weeks 1-2)

**Primary Branches:**
- `phase/data-asset-assessment` (main phase branch)
- Feature branches for market research, competitive analysis, user interviews

**Key Features:**
```
feature/dps/asset/market-opportunity-analysis
feature/dva/asset/census-data-value-assessment  
feature/dcl/asset/customer-discovery-interviews
feature/dps/asset/competitive-positioning
```

**Merge Strategy:**
- Feature branches → `phase/data-asset-assessment` → `develop` (weekly)
- Phase completion → merge to `develop` with comprehensive review

### Phase 2: Service Layer Design (Weeks 3-4)  

**Primary Branches:**
- `phase/service-layer-design` (main phase branch)
- Feature branches for service catalog, community strategy, pricing models

**Key Features:**
```
feature/dsd/service/professional-services-catalog
feature/dma/service/freemium-pricing-strategy
feature/deb/service/community-engagement-platform
feature/dts/service/security-compliance-framework
```

**Merge Strategy:**
- Feature branches → `phase/service-layer-design` → `develop` (weekly)
- Service designs require cross-agent review before merge

### Phase 3: Platform Development (Months 2-3)

**Primary Branches:**
- `phase/platform-development` (main phase branch)  
- Feature branches for core platform components, integrations, testing

**Key Features:**
```
feature/doe/platform/duckdb-census-integration
feature/doe/platform/mcp-natural-language-interface
feature/dts/platform/sql-injection-prevention
feature/doe/platform/performance-optimization
feature/dcl/platform/user-dashboard-interface
```

**Merge Strategy:**
- Feature branches → `phase/platform-development` → `develop` (bi-weekly)
- All platform features require technical review + security validation
- Performance benchmarks must pass before merge

### Phase 4: Ecosystem Growth (Month 4+)

**Primary Branches:**
- `phase/ecosystem-growth` (main phase branch)
- Feature branches for partnerships, integrations, scaling improvements

**Key Features:**
```
feature/deb/ecosystem/github-community-management
feature/deb/ecosystem/bi-tool-integrations  
feature/dma/ecosystem/enterprise-pricing-tiers
feature/dcl/ecosystem/content-marketing-automation
```

**Merge Strategy:**
- Feature branches → `phase/ecosystem-growth` → `develop` (weekly)
- Ecosystem features require business impact validation

## Agent-Specific Workflows

### Data Product Strategist (DPS)
**Primary Responsibilities:** Market analysis, competitive positioning, strategic planning
**Branch Pattern:** `feature/dps/[phase]/[strategy-component]`
**Review Requirements:** Business stakeholder approval, market validation data

### Data Ops Engineer (DOE)  
**Primary Responsibilities:** Technical architecture, data processing, performance optimization
**Branch Pattern:** `feature/doe/[phase]/[technical-component]`
**Review Requirements:** Technical lead approval, performance benchmarks, security scan

### Data Services Designer (DSD)
**Primary Responsibilities:** Service catalog, training programs, customer success
**Branch Pattern:** `feature/dsd/[phase]/[service-component]`  
**Review Requirements:** Customer feedback integration, pricing validation

### Data Ecosystem Builder (DEB)
**Primary Responsibilities:** Community building, partnerships, open source governance
**Branch Pattern:** `feature/deb/[phase]/[ecosystem-component]`
**Review Requirements:** Community stakeholder input, partnership legal review

### Data Trust Specialist (DTS)
**Primary Responsibilities:** Security, compliance, data governance, privacy
**Branch Pattern:** `feature/dts/[phase]/[security-component]`
**Review Requirements:** Security audit, compliance checklist completion

### Data Commercial Lead (DCL)
**Primary Responsibilities:** Sales, marketing, customer acquisition, user experience
**Branch Pattern:** `feature/dcl/[phase]/[commercial-component]`
**Review Requirements:** User testing results, conversion metric validation

### Data Value Analyst (DVA)
**Primary Responsibilities:** Data analysis, insights generation, value measurement
**Branch Pattern:** `feature/dva/[phase]/[analysis-component]`
**Review Requirements:** Statistical validation, methodology peer review

### Data Monetization Architect (DMA)
**Primary Responsibilities:** Pricing strategy, revenue optimization, business model design
**Branch Pattern:** `feature/dma/[phase]/[monetization-component]`
**Review Requirements:** Financial model validation, competitive pricing analysis

## Release Management

### Release Branch Strategy
```
main
├── release/v0.1.0-alpha (MVP release)
├── release/v0.2.0-beta (Community launch)  
├── release/v1.0.0 (Production launch)
└── release/v1.1.0 (Ecosystem features)
```

### Version Numbering
- **Major.Minor.Patch** (semantic versioning)
- **Alpha/Beta/RC** suffixes for pre-release versions
- **Phase alignment:** Major versions align with BMAD phase completions

### Release Criteria by Phase

**v0.1.0-alpha (End of Phase 2):**
- Market validation complete
- Service catalog defined
- Technical architecture documented
- Security framework designed

**v0.2.0-beta (End of Phase 3):**  
- MVP platform functional
- Core Census data queries working
- Basic natural language interface
- Community platform ready

**v1.0.0 (Community Launch):**
- Full feature set implemented
- Performance targets met
- Security audit passed
- Documentation complete
- Community governance established

**v1.1.0+ (Ecosystem Growth):**
- Partnership integrations
- Advanced features
- Scaling optimizations
- Enterprise capabilities

## Branch Protection Rules

### Main Branch
- Require pull request reviews (2+ reviewers)
- Require status checks to pass
- Require branches to be up to date
- Restrict pushes (admin only)
- Require signed commits

### Develop Branch  
- Require pull request reviews (1+ reviewer)
- Require status checks to pass
- Allow force pushes (maintainers only)

### Phase Branches
- Require pull request reviews (1+ phase lead reviewer)
- Require agent-specific validation
- Require BMAD methodology compliance check

### Release Branches
- Require pull request reviews (2+ reviewers including release manager)
- Require all automated tests to pass
- Require manual QA sign-off
- Require security scan approval

## Integration with BMAD Methodology

### Decision Point Gates
Each BMAD decision point requires specific branch merge approvals:

**Market Validation Gate (Phase 1 → Phase 2):**
- All `phase/data-asset-assessment` features merged and validated
- Market research data committed to repository
- Customer interview results documented
- Competitive analysis complete

**Technical Feasibility Gate (Phase 2 → Phase 3):**
- All `phase/service-layer-design` features merged
- Technical architecture reviewed and approved  
- Security framework validated
- Performance requirements confirmed

**MVP Quality Gate (Phase 3 → Phase 4):**
- All `phase/platform-development` features merged
- Core functionality tested and working
- Performance benchmarks achieved
- Security vulnerabilities resolved

**Launch Readiness Gate (Phase 4 Launch):**
- All `phase/ecosystem-growth` launch features merged
- Community platform operational
- Documentation complete
- Launch marketing prepared

### Agent Collaboration Points
Branches that require multi-agent collaboration:

**Strategy + Technical Integration:**
```
feature/dps+doe/platform/technical-architecture-alignment
feature/dts+doe/platform/security-performance-optimization
```

**Services + Commercial Integration:**
```
feature/dsd+dcl/service/customer-success-automation
feature/dma+dcl/service/pricing-conversion-optimization
```

**Ecosystem + Community Integration:**
```  
feature/deb+dcl/ecosystem/community-growth-strategy
feature/deb+dsd/ecosystem/partner-services-integration
```

## Automation and Tooling

### GitHub Actions Integration
- **Branch Creation:** Automated setup of phase branches with BMAD templates
- **Agent Validation:** Automated checks for agent-specific requirements
- **BMAD Compliance:** Validation that commits align with methodology requirements
- **Cross-Agent Reviews:** Automated assignment of reviewers based on branch patterns

### Commit Hook Integration  
- **Agent Identification:** Commit messages must identify responsible BMAD agent
- **Phase Tracking:** Commits tagged with current BMAD phase
- **Methodology Compliance:** Links to BMAD tasks and deliverables required

### Branch Analytics
- **Agent Contributions:** Track contributions by BMAD agent type
- **Phase Progress:** Monitor completion status of each BMAD phase
- **Collaboration Metrics:** Measure cross-agent collaboration effectiveness
- **Quality Metrics:** Track review cycles, bug rates, and performance by phase

This branching strategy ensures systematic development aligned with BMAD methodology while supporting the open source community nature of CensusChat. Each branch serves specific strategic purposes while maintaining code quality and collaboration standards.