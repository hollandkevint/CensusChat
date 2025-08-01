# CensusChat System Architecture

## Overview

CensusChat implements a modern three-layer architecture designed for high performance, scalability, and reliability. This architecture supports natural language queries on 11M+ Census records with sub-2 second response times while maintaining enterprise-grade security and compliance.

## Three-Layer Architecture

```mermaid
graph TB
    subgraph "User Interface Layer"
        WEB[Web Application<br/>React/Next.js]
        MOBILE[Mobile Apps<br/>React Native]
        API_GATEWAY[API Gateway<br/>Express.js/Node.js]
    end
    
    subgraph "Processing Layer"
        NLP[Natural Language<br/>Processing Service]
        QUERY[Query Processing<br/>Service]
        AUTH[Authentication<br/>Service]
        ANALYTICS[Analytics<br/>Service]
        USER_MGMT[User Management<br/>Service]
    end
    
    subgraph "Data Layer"
        DUCKDB[(DuckDB<br/>Analytics Engine)]
        REDIS[(Redis<br/>Cache Cluster)]
        POSTGRES[(PostgreSQL<br/>User Data)]
        S3[(S3<br/>Data Storage)]
    end
    
    subgraph "External Integrations"
        CENSUS_API[Census Bureau<br/>API]
        AUTH_PROVIDERS[Auth Providers<br/>OAuth/SAML]
        BI_TOOLS[BI Tools<br/>Tableau/Power BI]
    end
    
    %% User Interface Connections
    WEB --> API_GATEWAY
    MOBILE --> API_GATEWAY
    API_GATEWAY --> NLP
    API_GATEWAY --> QUERY
    API_GATEWAY --> AUTH
    API_GATEWAY --> ANALYTICS
    API_GATEWAY --> USER_MGMT
    
    %% Processing Layer Connections
    NLP --> DUCKDB
    QUERY --> DUCKDB
    QUERY --> REDIS
    AUTH --> POSTGRES
    AUTH --> AUTH_PROVIDERS
    USER_MGMT --> POSTGRES
    ANALYTICS --> REDIS
    
    %% Data Layer Connections
    DUCKDB --> S3
    REDIS --> DUCKDB
    
    %% External Integrations
    CENSUS_API --> S3
    BI_TOOLS --> API_GATEWAY
    
    %% Styling
    classDef ui fill:#e1f5fe
    classDef processing fill:#f3e5f5
    classDef data fill:#e8f5e8
    classDef external fill:#fff3e0
    
    class WEB,MOBILE,API_GATEWAY ui
    class NLP,QUERY,AUTH,ANALYTICS,USER_MGMT processing
    class DUCKDB,REDIS,POSTGRES,S3 data
    class CENSUS_API,AUTH_PROVIDERS,BI_TOOLS external
```

## Core Components

### User Interface Layer

#### Web Application
- **Technology**: React 18+ with TypeScript, Next.js 14+ for SSR
- **Features**: Natural language query interface, interactive dashboards, collaboration tools
- **Performance**: <3 second page load times, responsive design
- **Scalability**: CDN distribution, code splitting, lazy loading

#### Mobile Applications
- **Technology**: React Native for iOS and Android
- **Features**: Core query functionality, offline data access, push notifications
- **Performance**: Native performance with optimized data synchronization
- **User Experience**: Touch-optimized interface for field research

#### API Gateway
- **Technology**: Node.js 20+ with Express.js
- **Functionality**: Request routing, authentication, rate limiting, response transformation
- **Security**: JWT validation, input sanitization, CORS management
- **Monitoring**: Request/response logging, performance metrics, error tracking

### Processing Layer

#### Natural Language Processing Service
- **Technology**: Python 3.11+ with custom MCP implementation
- **Capabilities**: 
  - Intent recognition for demographic queries
  - Entity extraction (geographic areas, demographics, time periods)
  - SQL generation with optimization hints
  - Query validation and security constraints
- **Performance**: <500ms processing time for 95% of queries
- **Accuracy**: 95%+ query success rate with continuous learning

#### Query Processing Service
- **Technology**: Node.js with DuckDB integration
- **Functionality**:
  - SQL query execution and optimization
  - Result caching and materialized views
  - Geographic boundary processing
  - Statistical calculations and aggregations
- **Performance**: <2 second response times for complex queries
- **Scalability**: Horizontal scaling with query distribution

#### Authentication Service
- **Technology**: Node.js with JWT and OAuth 2.0
- **Features**:
  - Multi-provider authentication (Google, Microsoft, SAML)
  - Role-based access control (RBAC)
  - Session management with refresh tokens
  - Enterprise SSO integration
- **Security**: Token encryption, rate limiting, audit logging
- **Compliance**: SOC 2, GDPR, enterprise security standards

#### Analytics Service
- **Technology**: Node.js with event streaming
- **Capabilities**:
  - User behavior tracking and analysis
  - Query performance monitoring
  - Usage pattern identification
  - Predictive analytics for caching
- **Real-time**: Event processing with sub-second latency
- **Storage**: Time-series data with automated retention policies

#### User Management Service
- **Technology**: Node.js with PostgreSQL
- **Features**:
  - User profile management
  - Subscription and billing integration
  - Team and organization management
  - Usage quota enforcement
- **Scalability**: Database sharding for large user bases
- **Backup**: Automated backups with point-in-time recovery

### Data Layer

#### DuckDB Analytics Engine
- **Configuration**:
  - Memory allocation: 50% of available system memory
  - Thread pool: CPU count × 1.5 worker threads
  - Storage: NVMe SSD with S3 backup
- **Optimizations**:
  - Columnar storage for analytical workloads
  - Vectorized query execution
  - Custom indexes on geographic and demographic fields
  - Pre-computed aggregations for common patterns
- **Performance**: 10GB/s read throughput, sub-second query times
- **Reliability**: Continuous backup to S3, point-in-time recovery

#### Redis Cache Cluster
- **Configuration**:
  - Cluster mode with automatic failover
  - 6 nodes (3 primary, 3 replica) minimum
  - Memory optimization for large result sets
- **Caching Strategy**:
  - Query result caching with TTL policies
  - Geographic boundary caching
  - User session management
  - Frequently accessed data pre-loading
- **Performance**: <100ms cache retrieval times
- **Reliability**: Redis Sentinel for high availability

#### PostgreSQL User Database
- **Configuration**:
  - Primary-replica setup with read replicas
  - Connection pooling with PgBouncer
  - Automated backup and maintenance
- **Schema Design**:
  - User profiles and authentication data
  - Subscription and billing information
  - Team and organization structures
  - Audit logs and compliance data
- **Performance**: Optimized for OLTP workloads
- **Security**: Encryption at rest, access logging

#### S3 Data Storage
- **Structure**:
  - Raw Census data with versioning
  - Processed analytical datasets
  - User-generated content and exports
  - Backup and archival data
- **Organization**: Partitioned by data type and time period
- **Performance**: Intelligent tiering for cost optimization
- **Security**: Server-side encryption, IAM policies

## Data Flow Architecture

### Query Processing Flow

```mermaid
sequenceDiagram
    participant User as User Interface
    participant Gateway as API Gateway
    participant NLP as NLP Service
    participant Query as Query Service
    participant Cache as Redis Cache
    participant DB as DuckDB
    participant Analytics as Analytics Service
    
    User->>Gateway: Natural Language Query
    Gateway->>NLP: Parse Query Intent
    NLP->>NLP: Extract Entities & Generate SQL
    NLP->>Gateway: Validated SQL Query
    Gateway->>Query: Execute Query Request
    Query->>Cache: Check Cache
    alt Cache Hit
        Cache->>Query: Return Cached Results
    else Cache Miss
        Query->>DB: Execute SQL Query
        DB->>Query: Return Results
        Query->>Cache: Store Results
    end
    Query->>Gateway: Query Results
    Gateway->>Analytics: Log Query Metrics
    Gateway->>User: Formatted Response
```

### Data Ingestion Pipeline

```mermaid
graph LR
    subgraph "Data Sources"
        CENSUS[Census Bureau<br/>ACS Data]
        TIGER[TIGER/Line<br/>Boundaries]
    end
    
    subgraph "Ingestion Layer"
        EXTRACT[Data Extraction<br/>API Calls]
        TRANSFORM[Data Transformation<br/>ETL Pipeline]
        VALIDATE[Data Validation<br/>Quality Checks]
    end
    
    subgraph "Storage Layer"
        S3_RAW[S3 Raw Data<br/>Partitioned Storage]
        PROCESS[Processing Engine<br/>Apache Spark]
        S3_CLEAN[S3 Clean Data<br/>Optimized Format]
    end
    
    subgraph "Analytics Layer"
        DUCKDB_LOAD[DuckDB Loading<br/>Columnar Format]
        INDEX[Index Creation<br/>Performance Optimization]
        READY[Production Ready<br/>Query Optimized]
    end
    
    CENSUS --> EXTRACT
    TIGER --> EXTRACT
    EXTRACT --> TRANSFORM
    TRANSFORM --> VALIDATE
    VALIDATE --> S3_RAW
    S3_RAW --> PROCESS
    PROCESS --> S3_CLEAN
    S3_CLEAN --> DUCKDB_LOAD
    DUCKDB_LOAD --> INDEX
    INDEX --> READY
```

## Performance Specifications

### Response Time Targets
- **Simple Queries**: <500ms (95th percentile)
- **Complex Queries**: <2000ms (95th percentile)
- **Cached Results**: <100ms (frequently accessed data)
- **Geographic Queries**: <1000ms (spatial analysis)

### Scalability Targets
- **Concurrent Users**: 1,000+ simultaneous active users
- **Query Throughput**: 10,000+ queries per hour sustained
- **Data Volume**: 100GB+ with 20% annual growth capacity
- **Storage Performance**: 10GB/s read throughput

### Reliability Targets
- **System Uptime**: 99.9% availability (8.77 hours downtime/year)
- **Error Rate**: <0.1% failed requests under normal load
- **Recovery Time**: <15 minutes for complete service restoration
- **Data Consistency**: 100% accuracy for Census data replication

## Integration Architecture

### External API Integrations

```mermaid
graph TB
    subgraph "CensusChat Platform"
        API[API Gateway]
        SERVICES[Core Services]
    end
    
    subgraph "Authentication Providers"
        GOOGLE[Google OAuth]
        MICROSOFT[Microsoft Azure AD]
        SAML[SAML Providers]
    end
    
    subgraph "Business Intelligence Tools"
        TABLEAU[Tableau]
        POWERBI[Power BI]
        EXCEL[Excel Online]
        LOOKER[Google Looker]
    end
    
    subgraph "Data Sources"
        CENSUS_API[Census Bureau API]
        TIGER_API[TIGER/Line API]
    end
    
    subgraph "Infrastructure Services"
        AWS[AWS Services]
        MONITORING[Monitoring Tools]
        LOGGING[Logging Services]
    end
    
    %% Authentication flows
    API --> GOOGLE
    API --> MICROSOFT
    API --> SAML
    
    %% BI tool integrations
    TABLEAU --> API
    POWERBI --> API
    EXCEL --> API
    LOOKER --> API
    
    %% Data source connections
    SERVICES --> CENSUS_API
    SERVICES --> TIGER_API
    
    %% Infrastructure connections
    SERVICES --> AWS
    SERVICES --> MONITORING
    SERVICES --> LOGGING
```

### API Design Principles

#### RESTful API Standards
- **Resource-based URLs**: `/api/v1/queries`, `/api/v1/users`
- **HTTP methods**: GET, POST, PUT, DELETE for appropriate operations
- **Status codes**: Proper HTTP status code usage
- **Content negotiation**: JSON primary, CSV/XML support

#### Security Standards
- **Authentication**: Bearer token (JWT) required for all endpoints
- **Authorization**: Role-based access control (RBAC)
- **Rate limiting**: Per-user and per-endpoint limits
- **Input validation**: Comprehensive schema validation

#### Performance Standards
- **Response times**: <200ms for API responses (95th percentile)
- **Pagination**: Efficient cursor-based pagination for large result sets
- **Caching**: Aggressive caching with proper cache headers
- **Compression**: Gzip compression for all responses

## Deployment Architecture

The system is designed for containerized deployment using Kubernetes with support for multiple cloud providers and scaling scenarios. Detailed infrastructure specifications are covered in the Infrastructure Architecture document.

## Security Considerations

All components implement security-by-design principles with multiple layers of protection. Comprehensive security architecture details are provided in the Security Architecture document.

## Next Steps

This system architecture provides the foundation for:
1. **Microservices Architecture**: Detailed service boundaries and interactions
2. **Data Architecture**: Specific data modeling and flow patterns  
3. **Security Architecture**: Comprehensive security controls and compliance
4. **Infrastructure Architecture**: Deployment and operational considerations

Each architecture layer builds upon this system foundation to provide complete technical specifications for CensusChat implementation.