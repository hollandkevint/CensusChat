---
phase: 04-agent-sdk-integration
plan: 02
subsystem: api
tags: [mcp, agent-sdk, zod, region-comparison, feature-flag]

# Dependency graph
requires:
  - phase: 04-01
    provides: AgentService base class, queryWithSchema(), QueryResponseSchema
provides:
  - MCP config centralized in mcpConfig.ts
  - Region analyzer configuration for parallel comparisons
  - ComparisonResponseSchema for structured comparison outputs
  - isComparisonQuery() pattern detection
  - queryComparison() function for multi-region analysis
  - Query routes integration with USE_AGENT_SDK feature flag
affects: [04-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Feature flag pattern for gradual SDK rollout
    - Auto-routing based on query pattern detection
    - Centralized MCP configuration

key-files:
  created:
    - backend/src/agent/mcpConfig.ts
    - backend/src/agent/agents/regionAnalyzer.ts
    - backend/src/agent/agents/index.ts
  modified:
    - backend/src/agent/agentService.ts
    - backend/src/routes/query.routes.ts

key-decisions:
  - "Feature flag USE_AGENT_SDK for gradual rollout with fallback to existing flow"
  - "Pattern-based query detection using regex for vs/compare/versus/difference"
  - "Centralized MCP config allows environment-based server URL override"

patterns-established:
  - "Agent SDK feature flag: USE_AGENT_SDK=true enables new path, false uses existing"
  - "Comparison detection: isComparisonQuery() returns true for comparison patterns"
  - "Graceful fallback: Agent SDK failure falls through to standard processing"

# Metrics
duration: 3min
completed: 2026-02-03
---

# Phase 4 Plan 2: MCP Config & Multi-Region Comparison Summary

**Centralized MCP configuration with comparison query support and query route integration via feature flag**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-03T18:59:12Z
- **Completed:** 2026-02-03T19:02:01Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Centralized MCP server configuration in mcpConfig.ts with environment variable support
- Added regionAnalyzerConfig with system prompt for demographic analysis
- Implemented ComparisonResponseSchema and queryComparison() for multi-region analysis
- Integrated AgentService into query routes with USE_AGENT_SDK feature flag
- Pattern detection auto-routes comparison queries (vs/compare/versus/difference)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create MCP config and region analyzer configuration** - `b1418d8` (feat)
2. **Task 2: Add comparison query support to agentService** - `17afbd8` (feat)
3. **Task 3: Wire query routes to use AgentService** - `920134c` (feat)

## Files Created/Modified

- `backend/src/agent/mcpConfig.ts` - Centralized MCP server config with CENSUS_TOOLS constant
- `backend/src/agent/agents/regionAnalyzer.ts` - Region analyzer config with system prompt
- `backend/src/agent/agents/index.ts` - Barrel export for agents
- `backend/src/agent/agentService.ts` - Added comparison schema, queryComparison(), isComparisonQuery()
- `backend/src/routes/query.routes.ts` - AgentService integration with feature flag

## Decisions Made

1. **Feature flag approach** - USE_AGENT_SDK env var enables gradual rollout with automatic fallback
2. **Pattern-based detection** - Regex patterns detect comparison queries (vs, compare, versus, difference between)
3. **MCP URL configuration** - MCP_SERVER_URL env var defaults to localhost:3001

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - pre-existing TypeScript errors in healthcare_analytics and rateLimiting modules are unrelated to this work.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Query routes ready to use AgentService when USE_AGENT_SDK=true
- Comparison queries return structured ComparisonResponse with regions array
- Standard queries return QueryResponse with data and metadata
- Ready for 04-03 to build on this foundation

---
*Phase: 04-agent-sdk-integration*
*Completed: 2026-02-03*
