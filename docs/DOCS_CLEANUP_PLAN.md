# Documentation Cleanup & Organization Plan
## October 6, 2025 - Marketing Analytics & Geographic Hierarchy Expansion

### 📋 Current State Analysis

**Total Documentation Files**: 61 markdown files
**New Files (Untracked)**: 28 files
**Modified Files**: 14 files
**Deleted Files**: 14 old story/strategy files

---

## 🎯 Documentation Strategy

### Core Documentation (Keep in Root `/docs`)

**Getting Started**:
- ✅ `README.md` - Main documentation index
- ✅ `QUICK_START_EXPANDED.md` - **NEW** Quick start with 84 variables & 4 geo levels
- ✅ `API_KEY_SETUP.md` - Environment setup
- ⚠️ Consider deprecating old quick starts

**Technical Reference**:
- ✅ `MARKETING_ANALYTICS_EXPANSION.md` - **NEW** Main expansion guide (84 vars, 4 levels)
- ✅ `BACKEND_STRUCTURE.md` - Backend architecture
- ✅ `FRONTEND_ARCHITECTURE.md` - Frontend architecture
- ✅ `DATA_LOADING_SYSTEM.md` - Data loading patterns

**Status & Progress**:
- ✅ `PM_SUMMARY_OCT_2025.md` - October 1 MCP completion
- ✅ `MVP_STATUS.md` - Overall MVP status
- ✅ `DOCUMENTATION_STATUS.md` - **NEW** Expansion verification status
- ⚠️ `SESSION_SUMMARY.md` - Archive this (superseded by sessions folder)

**Implementation Guides**:
- ✅ `MCP_IMPLEMENTATION_SUMMARY.md` - MCP server implementation
- ⚠️ Move `IMPLEMENTATION_SUMMARY.md` from root to `/docs`
- ⚠️ Move `VARIABLE_CORRECTION_NOTE.md` from root to `/docs/sessions/`

---

## 📁 Organized Folder Structure

### `/docs/guides/` - How-to Guides
**Keep**:
- ✅ `ACS_DATA_LOADING.md` - Census API data loading
- ✅ `BLOCK_GROUP_VARIABLES.md` - Block group variables reference
- ✅ `RAILWAY_DEPLOYMENT.md` - Deployment guide

**Add**:
- 📝 Move `VARIABLE_EXPANSION_PLAN.md` here (rename to `VARIABLE_EXPANSION_GUIDE.md`)

### `/docs/api/` - API Documentation
**Keep**:
- ✅ `MCP_API_DOCUMENTATION.md`
- ✅ `FDB_MCP_DEVELOPER_GUIDE.md`
- ✅ `DEPLOYMENT_GUIDE.md`

### `/docs/references/` - Technical References
**Keep**:
- ✅ `/duckdb/` - DuckDB patterns and functions
- ✅ `/duckdb-mcp/` - MCP integration patterns

### `/docs/sessions/` - Session Summaries
**Keep**:
- ✅ `FINAL_STATUS.md`
- ✅ `SESSION_SUMMARY_OCT_2025.md`

**Add**:
- 📝 Create `SESSION_OCT_6_2025_EXPANSION.md` (this session)
- 📝 Move `VARIABLE_CORRECTION_NOTE.md` here

### `/docs/epics/` - Epic Documentation
**Keep**:
- ✅ `epic-2-duckdb-mcp-integration.md`

**Add**:
- 📝 Create `epic-3-marketing-analytics-expansion.md` (this expansion)

### `/docs/block-group/` - Block Group Specific
**Keep** (consolidate into MARKETING_ANALYTICS_EXPANSION.md):
- ⚠️ `BLOCK_GROUP_IMPLEMENTATION.md` - Archive (superseded)
- ⚠️ `BLOCK_GROUP_QUERIES_READY.md` - Archive (superseded)
- ⚠️ `BLOCK_GROUP_QUICKSTART.md` - Keep as reference
- ⚠️ `DATABASE_MERGE_COMPLETE.md` - Archive (one-time status)

---

## 🗄️ Archive Strategy

### Archive to `/archive/docs/old-sessions/`
- `SESSION_SUMMARY.md` (root) → superseded by sessions folder
- `NEXT_STEPS.md` (outdated)

### Archive to `/archive/docs/block-group-legacy/`
- `BLOCK_GROUP_IMPLEMENTATION.md`
- `BLOCK_GROUP_QUERIES_READY.md`
- `DATABASE_MERGE_COMPLETE.md`

### Archive to `/archive/docs/planning/`
- `brainstorming-session-results.md`
- `VARIABLE_EXPANSION_PLAN.md` (after creating guide version)

---

## 📝 New Documentation to Create

### 1. Epic 3 - Marketing Analytics Expansion
**File**: `/docs/epics/epic-3-marketing-analytics-expansion.md`
**Content**:
- Overview of 84-variable expansion
- 4-level geographic hierarchy
- Marketing & healthcare use cases
- Implementation timeline
- Success metrics

### 2. Session Summary - October 6, 2025
**File**: `/docs/sessions/SESSION_OCT_6_2025_EXPANSION.md`
**Content**:
- Variable expansion from 29 → 84
- Geographic hierarchy implementation
- Issues resolved (86 → 84, TypeScript errors, hierarchy script)
- Final data loading results
- Testing plan (MCP + natural language queries)

### 3. MCP Context Update
**File**: `/docs/api/MCP_SCHEMA_UPDATE_OCT_2025.md`
**Content**:
- New table schemas (state_data, tract_data, block_group_data_expanded)
- All 84 variables documented
- Geographic hierarchy metadata
- Updated tool descriptions for Claude
- Sample queries for each geography level

### 4. Evaluation Test Scenarios
**File**: `/backend/src/evals/README.md` + test scenarios
**Content**:
- Natural language query test suite
- Expected vs actual results
- Geography level routing tests
- Variable coverage tests
- Performance benchmarks

---

## 🔄 File Moves & Renames

### From Root to Docs:
```bash
mv ../IMPLEMENTATION_SUMMARY.md ../docs/IMPLEMENTATION_SUMMARY.md
mv ../VARIABLE_CORRECTION_NOTE.md ../docs/sessions/VARIABLE_CORRECTION_OCT_6.md
```

### Consolidations:
- Merge block-group specific docs into MARKETING_ANALYTICS_EXPANSION.md
- Update QUICK_START.md → point to QUICK_START_EXPANDED.md

### Archives:
```bash
# Old sessions
mv ../docs/SESSION_SUMMARY.md ../archive/docs/old-sessions/
mv ../docs/NEXT_STEPS.md ../archive/docs/old-sessions/

# Block group legacy
mv ../docs/block-group/BLOCK_GROUP_IMPLEMENTATION.md ../archive/docs/block-group-legacy/
mv ../docs/block-group/BLOCK_GROUP_QUERIES_READY.md ../archive/docs/block-group-legacy/
mv ../docs/block-group/DATABASE_MERGE_COMPLETE.md ../archive/docs/block-group-legacy/

# Planning
mv ../docs/brainstorming-session-results.md ../archive/docs/planning/
```

---

## 📊 Claude MCP Context Update

### Files to Update:
1. **`backend/src/services/anthropicService.ts`**
   - Update schema description with 84 variables
   - Add state_data, tract_data, block_group_data_expanded tables
   - Add geo_hierarchy table
   - Update tool descriptions

2. **`backend/src/validation/sqlSecurityPolicies.ts`**
   - Add new tables to allowlist
   - Add new columns to validation

3. **`backend/src/mcp/mcpServer.ts`**
   - Update get_information_schema with new tables
   - Add new resources for expanded data

### New MCP Tools to Consider:
- `get_geography_level_recommendation` - Suggests optimal geo level for query
- `get_variable_categories` - Returns 10 variable categories
- `get_hierarchy_path` - Gets full geographic hierarchy for a location

---

## ✅ Verification Checklist

**Before Commit**:
- [ ] All new docs have proper headers and dates
- [ ] Cross-references are updated
- [ ] Archive folders exist and are organized
- [ ] README.md index is updated
- [ ] No duplicate information across docs
- [ ] All file paths in docs are correct

**MCP Integration**:
- [ ] Claude context includes all 84 variables
- [ ] All 5 tables documented (state, county, tract, block_group_expanded, geo_hierarchy)
- [ ] Tool descriptions match capabilities
- [ ] Sample queries provided for each level

**Testing Prep**:
- [ ] Eval scenarios cover all geography levels
- [ ] Natural language query tests created
- [ ] Expected results documented
- [ ] Performance benchmarks defined

---

## 🚀 Execution Order

1. **Create New Documentation** (Epic 3, Session Summary, MCP Schema Update)
2. **Move Files** (Root → Docs, Docs → Archive)
3. **Update Cross-References** (README, index.md)
4. **Update MCP Context** (anthropicService, mcpServer, sqlPolicies)
5. **Create Test Scenarios** (evals folder)
6. **Git Commit** (Staged, descriptive message)
7. **Vercel Deploy** (Frontend update if needed)
8. **Local Testing** (MCP + DuckDB queries)

---

**Status**: 📝 Planning Complete - Ready for Execution
**Next**: Execute cleanup and create new documentation
