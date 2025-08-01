# CensusChat Technical Architecture

**Version:** 1.0  
**Date:** 2025-07-29  
**Status:** Initial Design  
**BMAD Agent:** data-ops-engineer (David Kim)

## Architecture Overview

CensusChat is designed as a three-layer platform that transforms US Census data into an accessible, high-performance natural language query system. The architecture balances simplicity for users with scalability for growth.

### Core Architecture Principles

1. **Performance First**: Sub-second query responses on 11M+ Census records
2. **Security by Design**: SQL injection prevention through query validation
3. **Scalability**: Horizontal scaling to support growing user base
4. **Simplicity**: Clean abstractions hiding data complexity from users
5. **Reliability**: 99.9% uptime through redundant, monitored systems

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CensusChat Platform                      │
├─────────────────────────────────────────────────────────────┤
│  User Interface Layer                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Web App   │  │  REST API   │  │   GraphQL   │          │
│  │ (React/Next)│  │   Gateway   │  │    API      │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
├─────────────────────────────────────────────────────────────┤
│  Natural Language Processing Layer                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │     MCP     │  │    Query    │  │   Result    │          │
│  │  Protocol   │  │ Validation  │  │ Formatting  │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
├─────────────────────────────────────────────────────────────┤
│  Data Processing Layer                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   DuckDB    │  │   Cache     │  │  Analytics  │          │
│  │   Engine    │  │  (Redis)    │  │   Engine    │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
├─────────────────────────────────────────────────────────────┤
│  Data Storage Layer                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Census    │  │ Geographic  │  │  Metadata   │          │
│  │    Data     │  │ Boundaries  │  │   Store     │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. User Interface Layer

#### Web Application (React/Next.js)
**Purpose**: Primary user interface for natural language queries
**Technology Stack**:
- Frontend: React 18+ with TypeScript
- Framework: Next.js 14+ for SSR and API routes
- Styling: Tailwind CSS with component library
- State Management: Zustand for client state
- Authentication: NextAuth.js with multiple providers

**Key Features**:
- Natural language query input with suggestions
- Real-time query results with visualizations
- Export functionality (CSV, JSON, PDF)
- User account management and billing
- Query history and saved searches

#### API Gateway (Node.js/Express)
**Purpose**: Centralized API management and request routing
**Technology Stack**:
- Runtime: Node.js 20+ with Express.js
- Validation: Joi for request validation
- Documentation: OpenAPI 3.0 with Swagger UI
- Rate Limiting: Redis-based with sliding window
- Monitoring: Prometheus metrics collection

**Key Features**:
- RESTful API endpoints for all platform functionality
- Request validation and sanitization
- Rate limiting and quota management
- API key management for developers
- Comprehensive logging and monitoring

### 2. Natural Language Processing Layer

#### MCP Protocol Implementation
**Purpose**: Transform natural language queries into SQL
**Technology Stack**:
- Language: Python 3.11+ with async/await
- NLP Framework: Custom MCP implementation
- ML Models: Fine-tuned models for Census domain
- Validation: SQL AST parsing with allowlist approach

**Query Processing Pipeline**:
1. **Intent Recognition**: Identify query type and target tables
2. **Entity Extraction**: Extract geographic areas, time periods, demographics
3. **SQL Generation**: Convert intent and entities to valid SQL
4. **Validation**: Ensure SQL meets security constraints (SELECT only)
5. **Optimization**: Query plan optimization for performance

#### Query Validation Engine
**Purpose**: Ensure all queries are safe and performant
**Security Constraints**:
- Only SELECT statements allowed
- No DDL, DML, or administrative commands
- Subquery depth limits (max 3 levels)
- Result set size limits (max 1M rows)
- Query timeout enforcement (30 seconds)

### 3. Data Processing Layer

#### DuckDB Analytical Engine
**Purpose**: High-performance analytical processing of Census data
**Configuration**:
- Memory Allocation: 50% of available system memory
- Thread Pool: CPU count * 1.5 worker threads
- Storage: Local SSD with S3 backup for persistence
- Optimization: Custom indexes on geographic and demographic fields

**Performance Optimizations**:
- Columnar storage for analytical workloads
- Vectorized query execution
- Parallel processing for large datasets
- Intelligent query caching and materialization
- Pre-computed aggregations for common queries

#### Redis Cache Layer
**Purpose**: High-speed caching for frequently accessed data
**Configuration**:
- Deployment: Redis Cluster for horizontal scaling
- Memory: 32GB+ per node with persistence
- Eviction: LRU policy with TTL-based expiration
- Replication: Master-slave setup for reliability

**Caching Strategy**:
- Query Result Caching: 1-hour TTL for analytical results
- Metadata Caching: 24-hour TTL for table schemas
- Geographic Caching: Persistent cache for boundary data
- User Session Caching: Authentication and preference data

### 4. Data Storage Layer

#### Census Data Storage
**Data Sources**:
- US Census ACS 5-Year Detailed Tables (44GB compressed)
- American Community Survey Public Use Microdata (PUMS)
- Decennial Census Summary Files
- Annual Economic Surveys (optional expansion)

**Storage Architecture**:
- Primary: DuckDB local storage (optimized for analytics)
- Backup: S3-compatible object storage with lifecycle policies
- Updates: Automated annual ingestion from Census API
- Partitioning: By geographic level and survey year

#### Geographic Boundary Data
**Data Sources**:
- TIGER/Line Shapefiles (all geographic levels)
- Cartographic Boundary Files (simplified for visualization)
- Geographic Relationship Files (hierarchy mappings)

**Processing Pipeline**:
- Automated download from Census FTP servers
- Geometry simplification for web visualization
- Spatial indexing for fast geographic queries
- Integration with demographic data via GEOID keys

## Security Architecture

### Multi-Layer Security Model

#### Application Security
- **Input Validation**: All user inputs validated against schemas
- **SQL Injection Prevention**: AST-based parsing with allowlist validation
- **Authentication**: JWT tokens with refresh rotation
- **Authorization**: Role-based access control (RBAC)
- **Rate Limiting**: Per-user and per-API-key quotas

#### Infrastructure Security
- **Network Security**: VPC with private subnets, security groups
- **Encryption**: TLS 1.3 for transit, AES-256 for data at rest
- **Key Management**: AWS KMS or equivalent for secret management
- **Monitoring**: Comprehensive logging with anomaly detection
- **Backup**: Encrypted backups with point-in-time recovery

#### Compliance Framework
- **Data Privacy**: No PII processing (Census data is aggregated)
- **Access Logging**: Complete audit trail for all data access
- **Incident Response**: Automated alerting and response procedures
- **Vulnerability Management**: Regular security scanning and updates

## Performance Specifications

### Response Time Targets
- **Simple Queries**: <500ms (single table, basic aggregation)
- **Complex Queries**: <2000ms (multi-table joins, advanced analytics)
- **Cached Results**: <100ms (frequently accessed data)
- **Geographic Queries**: <1000ms (spatial joins and filtering)

### Scalability Targets
- **Concurrent Users**: 1,000+ simultaneous users
- **Query Throughput**: 10,000+ queries per hour
- **Data Volume**: 100GB+ Census data with room for expansion
- **Storage Growth**: 20% annual growth capacity

### Reliability Targets
- **Uptime**: 99.9% availability (8.77 hours downtime per year)
- **Error Rate**: <0.1% failed requests
- **Recovery Time**: <15 minutes for service restoration
- **Data Consistency**: 100% accuracy for Census data replication

## Development & Deployment

### Technology Stack Summary
```yaml
Frontend:
  - React 18+ with TypeScript
  - Next.js 14+ framework
  - Tailwind CSS styling
  - Zustand state management

Backend:
  - Node.js 20+ with Express
  - Python 3.11+ for NLP processing
  - DuckDB for analytical processing
  - Redis for caching

Infrastructure:
  - Docker containers
  - Kubernetes orchestration
  - AWS/GCP cloud platform
  - Terraform for IaC
```

### Development Environment
- **Local Development**: Docker Compose with all services
- **Testing**: Jest (frontend), pytest (backend), automated integration tests
- **CI/CD**: GitHub Actions with automated testing and deployment
- **Monitoring**: Prometheus + Grafana for metrics, ELK stack for logs

### Deployment Strategy
- **Staging Environment**: Full production replica for testing
- **Blue-Green Deployment**: Zero-downtime deployments
- **Feature Flags**: Gradual rollout of new functionality
- **Rollback Capability**: Immediate rollback for failed deployments

## Monitoring & Observability

### Application Metrics
- **Performance**: Query response times, throughput, error rates
- **Usage**: Active users, query patterns, feature adoption
- **Business**: Conversion rates, subscription metrics, revenue
- **Technical**: CPU/memory usage, database performance, cache hit rates

### Alerting Strategy
- **Critical Alerts**: Service outages, security incidents, data corruption
- **Warning Alerts**: Performance degradation, high error rates, capacity issues
- **Info Alerts**: Deployment notifications, maintenance windows
- **Escalation**: Automated escalation based on severity and response time

## Future Architecture Considerations

### Phase 2 Enhancements (Months 4-6)
- **Multi-tenant Architecture**: Isolated data and processing per organization
- **Advanced Analytics**: Machine learning models for trend analysis
- **Real-time Data**: Streaming updates for new Census releases
- **Mobile Apps**: Native iOS/Android applications

### Phase 3 Scaling (Months 7-12)
- **Multi-region Deployment**: Global CDN with regional data centers
- **Microservices Architecture**: Service decomposition for independent scaling
- **Event-driven Architecture**: Async processing with message queues
- **Data Lakehouse**: Expanded data sources beyond Census

### Integration Roadmap
- **BI Tool Connectors**: Tableau, Power BI, Looker integrations
- **API Ecosystem**: Third-party developer platform
- **Workflow Automation**: Zapier, IFTTT integrations
- **Academic Platforms**: Canvas, Blackboard, institutional access

---

**Architecture Status**: Initial Design Complete  
**Next Review**: Technical feasibility validation  
**Implementation Start**: Upon business validation approval  
**Estimated Development Time**: 12-16 weeks for MVP