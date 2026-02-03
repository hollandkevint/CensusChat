---
phase: 03-interactive-ui-layer
plan: 01
subsystem: ui
tags: [mcp-apps, vite, iframe, postmessage, ext-apps, react-table]

# Dependency graph
requires:
  - phase: 02-mcp-transport-migration
    provides: MCP SDK 1.25.3 with StreamableHTTPServerTransport
provides:
  - MCP Apps build pipeline with Vite single-file output
  - AppBridge component for sandboxed iframe rendering
  - UI resource registration on MCP server
affects: [03-02, 03-03, frontend-query-results]

# Tech tracking
tech-stack:
  added:
    - "@modelcontextprotocol/ext-apps@1.0.1"
    - "@tanstack/react-table@8.21.3"
    - "vite@6.x"
    - "vite-plugin-singlefile@2.x"
  patterns:
    - "Single-file HTML bundles via Vite viteSingleFile plugin"
    - "Sandboxed iframe with postMessage communication"
    - "registerAppTool/registerAppResource for MCP Apps"

key-files:
  created:
    - "mcp-apps/package.json"
    - "mcp-apps/vite.config.ts"
    - "mcp-apps/tsconfig.json"
    - "mcp-apps/src/shared/app-bridge.ts"
    - "frontend/src/components/AppBridge.tsx"
    - "backend/src/mcp/mcpApps/.gitkeep"
  modified:
    - "backend/package.json"
    - "frontend/package.json"
    - "backend/src/mcp/mcpServer.ts"
    - "backend/tsconfig.json"

key-decisions:
  - "Output MCP Apps to backend/src/mcp/mcpApps/ for serving via MCP resources"
  - "Use sandbox='allow-scripts' (not allow-same-origin) for iframe security"
  - "Graceful degradation when UI resources not built yet (JSON fallback)"

patterns-established:
  - "MCP Apps use ui:// URI scheme (e.g., ui://censuschat/data-table.html)"
  - "Tool results passed via postMessage with type='tool-result'"
  - "App signals ready via postMessage with type='ui/ready'"

# Metrics
duration: 4min
completed: 2026-02-03
---

# Phase 3 Plan 1: MCP Apps Infrastructure Summary

**Vite build pipeline for single-file HTML apps, AppBridge iframe host, and MCP server UI resource registration**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-03T15:25:17Z
- **Completed:** 2026-02-03T15:29:19Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Created mcp-apps/ directory with Vite build config producing single-file HTML bundles
- Installed @modelcontextprotocol/ext-apps in backend and frontend
- Built AppBridge React component with sandboxed iframe and postMessage communication
- Updated MCP server to use registerAppTool for execute_query with UI resource URI
- Added registerUIResources function for data-table, bar-chart, line-chart resources

## Task Commits

Each task was committed atomically:

1. **Task 1: Create MCP Apps build pipeline** - `fa8a620` (feat)
2. **Task 2: Install dependencies and create AppBridge** - `dd4d204` (feat)
3. **Task 3: Add UI resource registration to MCP server** - `6937af1` (feat)

## Files Created/Modified

- `mcp-apps/package.json` - Build tooling and dependencies
- `mcp-apps/vite.config.ts` - Single-file bundle configuration
- `mcp-apps/tsconfig.json` - TypeScript config for apps
- `mcp-apps/src/shared/app-bridge.ts` - Shared utilities and types
- `frontend/src/components/AppBridge.tsx` - Iframe host component
- `backend/src/mcp/mcpServer.ts` - UI resource registration
- `backend/src/mcp/mcpApps/.gitkeep` - Placeholder for build output
- `backend/tsconfig.json` - moduleResolution update to node16
- `backend/package.json` - Added ext-apps dependency
- `frontend/package.json` - Added ext-apps and react-table

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Output to backend/src/mcp/mcpApps/ | Apps served as MCP resources from server directory |
| sandbox="allow-scripts" only | Security: no same-origin access to parent DOM/storage |
| Graceful degradation | Tools work without UI resources (JSON response fallback) |
| moduleResolution: node16 | Required for ext-apps subpath exports resolution |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated moduleResolution to node16**
- **Found during:** Task 3 (MCP server modifications)
- **Issue:** moduleResolution: "node" couldn't resolve @modelcontextprotocol/ext-apps/server subpath
- **Fix:** Changed to moduleResolution: "node16" in backend/tsconfig.json
- **Files modified:** backend/tsconfig.json
- **Verification:** TypeScript compiles mcpServer.ts without ext-apps error
- **Committed in:** 6937af1 (part of Task 3 commit)

---

**Total deviations:** 1 auto-fixed (blocking issue)
**Impact on plan:** Necessary for ext-apps subpath exports. No scope creep.

## Issues Encountered

None - plan executed as specified with one blocking fix.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- MCP Apps infrastructure ready for building actual apps
- Next: 03-02 creates DataTable app using this pipeline
- UI resources will be built when mcp-apps/npm run build executes

---
*Phase: 03-interactive-ui-layer*
*Completed: 2026-02-03*
