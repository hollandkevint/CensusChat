# Epic 4: User Experience & Engagement Platform

**Epic ID**: EPIC-004
**Created**: 2025-11-25
**Status**: 🚧 IN PROGRESS
**Target Duration**: 4 weeks
**Epic Type**: Feature Development

## Executive Summary

Transform CensusChat from a functional query tool into an engaging analytics platform that drives repeat usage and premium conversion. With the data infrastructure complete (Epic 2: MCP/DuckDB + Epic 3: 327K geographies, 84 variables), this epic focuses on user-facing features that maximize engagement, retention, and revenue.

## Business Value

### Key Outcomes
- **Retention**: Query history increases return visits by 60%+ (industry benchmark)
- **Conversion**: Visualization features justify premium pricing ($297/month)
- **Differentiation**: Smart suggestions create competitive moat
- **Revenue**: Collaboration features enable team tier ($49/user/month)

### Success Metrics
| Metric | Target |
|--------|--------|
| Query success rate | >90% |
| Visualization adoption | 60% of queries |
| Query history usage | 50% of users |
| Suggestion acceptance | 40% click-through |
| Cache hit rate | 80%+ |
| User return rate (7-day) | 70%+ |

## Technical Context

### Current State (Post-Epic 3)
- ✅ **Data Infrastructure**: 327,337 geographies across 4 levels
- ✅ **Variables**: 84 marketing + healthcare demographics
- ✅ **MCP Validation**: Production SQL security layer operational
- ✅ **DuckDB**: Stable connection pooling, zero crashes
- ✅ **Frontend**: Basic ChatInterface functional

### Target State
- ✅ **Interactive Visualizations**: Charts, maps, auto-selection
- ✅ **Query History**: Persistent storage, favorites, search
- ✅ **Smart Suggestions**: Context-aware recommendations
- ✅ **Collaboration**: Shareable queries with permissions
- ✅ **Analytics**: Usage tracking and performance optimization

## Epic Scope

### In Scope
1. Interactive data visualization with Recharts
2. Query history persistence with Zustand
3. MCP schema update for Epic 3's expanded data
4. Smart query suggestion engine
5. Basic collaboration and sharing
6. Usage analytics and performance monitoring

### Out of Scope
- Mobile native apps (future epic)
- Advanced ML/predictive analytics (future epic)
- Enterprise SSO/SAML (future epic)
- Full API platform with SDKs (future epic)

---

## Stories Overview

### Story 4.1: Enhanced Data Visualization
**Week 1 | Priority: Critical | Effort: 3 days**

Implement interactive charts using the existing Recharts library for professional data presentation.

**Key Deliverables**:
- Bar charts for demographic comparisons
- Choropleth/geographic maps for location data
- Line charts for income distributions
- Pie charts for composition analysis
- Scatter plots for correlation analysis
- Auto-selection based on query/data type
- PNG/PDF export for presentations

**Technical Approach**:
- Create `frontend/src/components/visualization/` directory
- Implement `DataVisualization.tsx` wrapper component
- Add `ChartSelector.ts` for automatic chart type selection
- Integrate with existing query results in ChatInterface

**Files to Create/Modify**:
- `frontend/src/components/visualization/DataVisualization.tsx`
- `frontend/src/components/visualization/BarChart.tsx`
- `frontend/src/components/visualization/LineChart.tsx`
- `frontend/src/components/visualization/PieChart.tsx`
- `frontend/src/components/visualization/MapChart.tsx`
- `frontend/src/components/visualization/ChartSelector.ts`
- `frontend/src/components/visualization/ExportControls.tsx`
- `frontend/src/components/ChatInterface.tsx` (integrate visualization)

**Success Criteria**:
- [ ] 5 chart types supported (bar, line, pie, scatter, map)
- [ ] Automatic chart selection based on data structure
- [ ] Interactive tooltips with statistical details
- [ ] One-click export to PNG/PDF
- [ ] < 1 second render time for typical datasets

---

### Story 4.2: Query History & Persistence
**Week 1-2 | Priority: High | Effort: 2 days**

Enable users to save, search, and re-execute previous queries.

**Key Deliverables**:
- Store last 100 queries with timestamps and results
- Favorites/bookmarks system
- Search within query history
- One-click re-execution
- Category tagging (healthcare, marketing, custom)
- Local storage with Zustand persistence

**Technical Approach**:
- Extend Zustand store with query history state
- Implement localStorage persistence middleware
- Create QueryHistory sidebar component
- Add keyboard shortcuts for quick access

**Files to Create/Modify**:
- `frontend/src/store/queryHistoryStore.ts`
- `frontend/src/components/QueryHistory.tsx`
- `frontend/src/components/QueryHistoryItem.tsx`
- `frontend/src/components/ChatInterface.tsx` (integrate history)
- `frontend/src/hooks/useQueryHistory.ts`

**Success Criteria**:
- [ ] Store 100+ query history items locally
- [ ] Sub-second search across query history
- [ ] One-click query re-execution from history
- [ ] Favorites persist across browser sessions
- [ ] Categories help organize queries

---

### Story 4.3: MCP Schema Update for Expanded Data
**Week 2 | Priority: High | Effort: 2 days**

Update MCP tools to support Epic 3's 84 variables and 4 geography levels.

**Key Deliverables**:
- Update `sqlSecurityPolicies.ts` with new tables
- Add `state_data`, `tract_data`, `block_group_data_expanded` to allowlist
- Update column allowlists for 84 variables
- Update `mcpServer.ts` with expanded schema resources
- Enable geographic routing in queries
- Update information schema tool

**Technical Approach**:
- Analyze Epic 3's variable mapping (`acsVariablesExpanded.ts`)
- Update security policies for each new table
- Add MCP resources for each geography level
- Test queries at all 4 geographic levels

**Files to Create/Modify**:
- `backend/src/validation/sqlSecurityPolicies.ts`
- `backend/src/mcp/mcpServer.ts`
- `backend/src/mcp/mcpClient.ts`
- `backend/src/__tests__/services/mcpServerService.test.ts`

**Success Criteria**:
- [ ] All 4 geography levels queryable via MCP
- [ ] All 84 variables accessible
- [ ] Security policies enforce proper access
- [ ] MCP resources expose expanded schema
- [ ] Existing county queries still work

---

### Story 4.4: Smart Query Suggestions
**Week 2-3 | Priority: Medium-High | Effort: 3 days**

Context-aware query recommendations to accelerate user workflows.

**Key Deliverables**:
- Auto-complete based on Census terminology
- Related questions based on current query context
- Healthcare-specific templates (Medicare, SDOH, facility adequacy)
- Marketing templates (income segmentation, technology adoption)
- Trending queries display

**Technical Approach**:
- Create suggestion engine service
- Build query template library
- Implement context extraction from conversation
- Add suggestion UI component

**Files to Create/Modify**:
- `frontend/src/services/suggestionEngine.ts`
- `frontend/src/data/queryTemplates.ts`
- `frontend/src/components/QuerySuggestions.tsx`
- `frontend/src/components/ChatInterface.tsx` (integrate suggestions)
- `backend/src/services/suggestionService.ts` (optional backend)

**Success Criteria**:
- [ ] 10+ relevant suggestions per query context
- [ ] 20+ healthcare query templates
- [ ] 20+ marketing query templates
- [ ] Context-aware follow-up questions
- [ ] < 200ms suggestion response time

---

### Story 4.5: Basic Collaboration & Sharing
**Week 3 | Priority: Medium | Effort: 2 days**

Enable query sharing for team workflows and presentations.

**Key Deliverables**:
- Generate shareable links with embedded results
- Expiration controls (7/30/90 days)
- View-only permissions (edit permissions future)
- Shared query viewer page

**Technical Approach**:
- Create share token generation service
- Store shared queries in backend (or local for MVP)
- Build share dialog component
- Create public viewer route

**Files to Create/Modify**:
- `backend/src/services/sharingService.ts`
- `backend/src/routes/share.routes.ts`
- `frontend/src/components/ShareDialog.tsx`
- `frontend/src/app/shared/[token]/page.tsx`
- `backend/src/models/share.models.ts`

**Success Criteria**:
- [ ] Secure shareable links generated
- [ ] 30-day default expiration
- [ ] Shared queries viewable without login
- [ ] Share dialog accessible from results
- [ ] Links include query + results snapshot

---

### Story 4.6: Usage Analytics & Performance
**Week 3-4 | Priority: Medium | Effort: 2 days**

Implement tracking for product intelligence and performance optimization.

**Key Deliverables**:
- Query success/failure rate tracking
- Time-to-insight measurement
- Feature adoption tracking
- Cache hit rate optimization
- Performance monitoring

**Technical Approach**:
- Create analytics service (privacy-compliant)
- Add tracking hooks to key user actions
- Implement Redis cache improvements
- Build simple analytics dashboard (internal)

**Files to Create/Modify**:
- `frontend/src/services/analyticsService.ts`
- `frontend/src/hooks/useAnalytics.ts`
- `backend/src/services/cacheService.ts` (optimize)
- `backend/src/middleware/analyticsMiddleware.ts`

**Success Criteria**:
- [ ] Track 15+ key user interaction events
- [ ] Query success rate measurable (target >90%)
- [ ] Cache hit rate measurable (target >80%)
- [ ] Privacy compliance (no PII tracking)
- [ ] Performance baselines established

---

## Technical Architecture

### Frontend Architecture
```
frontend/src/
├── components/
│   ├── visualization/       # NEW: Chart components
│   │   ├── DataVisualization.tsx
│   │   ├── BarChart.tsx
│   │   ├── LineChart.tsx
│   │   ├── PieChart.tsx
│   │   └── ExportControls.tsx
│   ├── QueryHistory.tsx     # NEW: History sidebar
│   ├── QuerySuggestions.tsx # NEW: Smart suggestions
│   ├── ShareDialog.tsx      # NEW: Sharing modal
│   └── ChatInterface.tsx    # MODIFY: Integrate new features
├── store/
│   └── queryHistoryStore.ts # NEW: Zustand history store
├── services/
│   ├── suggestionEngine.ts  # NEW: Query suggestions
│   └── analyticsService.ts  # NEW: Usage tracking
└── app/
    └── shared/[token]/      # NEW: Shared query viewer
```

### Backend Architecture
```
backend/src/
├── validation/
│   └── sqlSecurityPolicies.ts  # MODIFY: Add new tables
├── mcp/
│   ├── mcpServer.ts            # MODIFY: Expanded schema
│   └── mcpClient.ts            # MODIFY: New resources
├── services/
│   ├── sharingService.ts       # NEW: Share management
│   └── cacheService.ts         # MODIFY: Optimization
└── routes/
    └── share.routes.ts         # NEW: Share endpoints
```

---

## Dependencies

### Technical Dependencies
- Recharts (already installed in frontend)
- Zustand (already installed in frontend)
- Epic 3 data tables (state_data, tract_data, block_group_data_expanded)
- Existing MCP infrastructure (Epic 2)

### External Dependencies
- None (all features use existing infrastructure)

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Visualization performance with large datasets | Medium | Medium | Implement data sampling for charts >10K rows |
| Query history storage limits | Low | Low | Implement LRU eviction after 100 queries |
| MCP schema update breaking existing queries | Medium | High | Comprehensive test suite, feature flags |
| Sharing security vulnerabilities | Low | High | Token expiration, rate limiting, audit logging |

---

## Timeline & Milestones

### Week 1 (Days 1-5)
- **Day 1-3**: Story 4.1 - Enhanced Data Visualization
- **Day 4-5**: Story 4.2 - Query History & Persistence

### Week 2 (Days 6-10)
- **Day 6-7**: Story 4.3 - MCP Schema Update
- **Day 8-10**: Story 4.4 - Smart Query Suggestions (start)

### Week 3 (Days 11-15)
- **Day 11-12**: Story 4.4 - Smart Query Suggestions (complete)
- **Day 13-15**: Story 4.5 - Basic Collaboration & Sharing

### Week 4 (Days 16-20)
- **Day 16-17**: Story 4.6 - Usage Analytics & Performance
- **Day 18-19**: Integration testing & bug fixes
- **Day 20**: Documentation & deployment preparation

---

## Definition of Done

### Epic Completion Criteria
- [ ] All 6 stories completed and tested
- [ ] Interactive visualizations working for all query types
- [ ] Query history persists across sessions
- [ ] All 4 geography levels and 84 variables accessible via MCP
- [ ] Smart suggestions appearing contextually
- [ ] Sharing functionality operational
- [ ] Analytics tracking key metrics
- [ ] All existing functionality preserved
- [ ] Documentation updated

### Testing Requirements
- [ ] Unit tests for all new components
- [ ] Integration tests for MCP schema updates
- [ ] E2E tests for critical user flows
- [ ] Performance tests for visualization rendering
- [ ] Security tests for sharing functionality

---

## Resources & References

### Implementation Guides
- `/docs/references/duckdb/` - DuckDB patterns
- `/docs/epics/epic-3-marketing-analytics-expansion.md` - Variable reference
- `/backend/src/utils/acsVariablesExpanded.ts` - 84 variable definitions

### Design References
- Recharts documentation: https://recharts.org/
- Zustand documentation: https://zustand-demo.pmnd.rs/

---

*Epic documented and ready for implementation*
*Created: 2025-11-25*
