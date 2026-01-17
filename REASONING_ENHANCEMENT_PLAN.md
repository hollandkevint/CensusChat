# CensusChat API Enhancement: Reasoning & Context

**Status:** 📋 Planning Phase
**Priority:** High
**Created:** 2025-10-14
**Est. Completion:** 2-3 dev days

---

## Executive Summary

Enhance the CensusChat API response to include transparent reasoning about how queries are analyzed and what the results mean. This will improve user trust, enable learning, and facilitate data exploration through contextual insights and suggested refinements.

---

## Problem Statement

**Current State:**
- API returns data successfully after Claude analyzes queries
- Users see results but don't understand the analysis process
- No context about what the data means
- No guidance on how to refine or explore further

**Pain Points:**
1. **Lack of Transparency** - Users don't see how queries are interpreted
2. **No Context** - Results appear without statistical context or insights
3. **Limited Learning** - Users can't learn from the analysis process
4. **Poor Exploration** - No suggestions for refining queries

---

## Solution Overview

Add a `reasoning` object to API responses with two main sections:

### Pre-Query Reasoning
Shows how the query was analyzed before execution:
- User intent (demographics, healthcare, analytics)
- Extracted entities (locations, demographics, filters)
- Confidence level in interpretation
- Generated SQL with explanation

### Post-Query Context
Provides insights after results are returned:
- Key findings and patterns
- Statistical context (averages, comparisons)
- Data quality assessment
- Suggested refinements for exploration

---

## Technical Architecture

### Backend Changes

#### 1. Enhanced Response Structure
**File:** `backend/src/routes/query.routes.ts`

```typescript
interface ApiResponse {
  success: boolean;
  message: string;
  data: any[];
  metadata: {
    queryTime: number;
    totalRecords: number;
    dataSource: string;
    // ... existing fields
  };
  reasoning: {
    pre: PreQueryReasoning;
    post: PostQueryContext;
  };
}
```

#### 2. Pre-Query Reasoning (Already Available)
Captured from `anthropicService.analyzeQuery()`:
```typescript
interface PreQueryReasoning {
  intent: 'demographics' | 'healthcare' | 'analytics';
  entities: {
    locations: string[];
    demographics: string[];
    ageGroups: string[];
    incomeRanges: string[];
  };
  filters: Record<string, any>;
  confidence: number;  // 0.0 - 1.0
  sqlQuery: string;
  explanation: string;
}
```

#### 3. Post-Query Context (New Service)
**File:** `backend/src/services/postQueryAnalysis.ts`

```typescript
interface PostQueryContext {
  insights: string[];
  suggestedRefinements: string[];
  dataQuality: DataQualityMetrics;
  statisticalSummary: StatisticalSummary;
}

interface DataQualityMetrics {
  completeness: number;  // % of non-null values
  recordCount: number;
  hasOutliers: boolean;
  coverage: string;  // e.g., "15 of 56 Montana counties"
}

interface StatisticalSummary {
  numericFields: Record<string, {
    min: number;
    max: number;
    avg: number;
    median: number;
  }>;
  context: string;  // Human-readable comparison
}
```

#### 4. Service Implementation

```typescript
export class PostQueryAnalysisService {
  // Generate insights using Claude
  async generateInsights(
    data: any[],
    originalQuery: string,
    preAnalysis: PreQueryReasoning
  ): Promise<string[]> {
    // Use Anthropic API to analyze results
    // Return 2-4 key insights
  }

  // Assess data quality
  assessDataQuality(data: any[]): DataQualityMetrics {
    // Calculate completeness
    // Check for outliers
    // Assess coverage
  }

  // Generate statistical summary
  generateStatistics(data: any[]): StatisticalSummary {
    // Calculate min/max/avg/median for numeric fields
    // Generate contextual comparisons
  }
}
```

### Frontend Changes

#### 1. Type Definitions
**File:** `frontend/src/types/query.types.ts`

Add `reasoning?` field to `ChatMessage` interface.

#### 2. UI Components
**File:** `frontend/src/components/ChatInterface.tsx`

**Component A: Query Analysis Panel** (Expandable)
```jsx
<details className="mt-3 border rounded">
  <summary>🔍 How was this analyzed?</summary>
  <div className="p-3 bg-gray-50">
    <div><strong>Intent:</strong> {reasoning.pre.intent}</div>
    <div><strong>Confidence:</strong> {reasoning.pre.confidence * 100}%</div>
    <div><strong>Filters:</strong> {JSON.stringify(reasoning.pre.filters)}</div>
    <details className="mt-2">
      <summary>View SQL Query</summary>
      <pre className="bg-gray-800 text-green-400 p-2 rounded text-xs">
        {reasoning.pre.sqlQuery}
      </pre>
      <p className="text-sm mt-1">{reasoning.pre.explanation}</p>
    </details>
  </div>
</details>
```

**Component B: Insights Panel**
```jsx
{reasoning.post.insights.length > 0 && (
  <div className="mt-4 p-3 bg-blue-50 border-l-4 border-blue-500">
    <h4 className="font-semibold mb-2">💡 Key Insights</h4>
    <ul className="space-y-1">
      {reasoning.post.insights.map((insight, i) => (
        <li key={i} className="text-sm">{insight}</li>
      ))}
    </ul>
  </div>
)}
```

**Component C: Suggested Refinements (Enhanced)**
```jsx
<div className="mt-3 flex flex-wrap gap-2">
  {reasoning.post.suggestedRefinements.map((suggestion, i) => (
    <button
      key={i}
      onClick={() => setInput(suggestion)}
      className="px-3 py-1 bg-purple-100 hover:bg-purple-200
                 rounded-full text-sm transition"
    >
      {suggestion}
    </button>
  ))}
</div>
```

**Component D: Data Quality Indicator**
```jsx
<div className="text-xs mt-2 flex items-center gap-2">
  <span className={`px-2 py-1 rounded ${
    reasoning.post.dataQuality.completeness > 90
      ? 'bg-green-100 text-green-800'
      : 'bg-yellow-100 text-yellow-800'
  }`}>
    {reasoning.post.dataQuality.completeness}% complete
  </span>
  <span className="text-gray-600">
    {reasoning.post.dataQuality.coverage}
  </span>
</div>
```

---

## Implementation Steps

### Phase 1: Backend Foundation (Day 1)
1. ✅ Create `backend/src/services/postQueryAnalysis.ts`
2. ✅ Implement `assessDataQuality()` function
3. ✅ Implement `generateStatistics()` function
4. ✅ Implement `generateInsights()` function (async, uses Claude)
5. ✅ Write unit tests for each function

### Phase 2: API Integration (Day 1-2)
6. ✅ Update `query.routes.ts` to call post-query analysis
7. ✅ Add `reasoning` to response structure
8. ✅ Update TypeScript interfaces
9. ✅ Test API responses include reasoning

### Phase 3: Frontend UI (Day 2)
10. ✅ Update `ChatMessage` type definition
11. ✅ Create Query Analysis Panel component
12. ✅ Create Insights Panel component
13. ✅ Enhance Suggested Refinements to be clickable
14. ✅ Add Data Quality indicator

### Phase 4: Testing & Polish (Day 2-3)
15. ✅ Test with various query types
16. ✅ Optimize performance (caching, async loading)
17. ✅ Error handling for insight generation failures
18. ✅ UI polish and responsiveness

---

## Example API Response

```json
{
  "success": true,
  "message": "Found 15 records matching your query",
  "data": [ /* block group data */ ],
  "metadata": {
    "queryTime": 1.23,
    "totalRecords": 15,
    "dataSource": "DuckDB Production (MCP Validated)"
  },
  "reasoning": {
    "pre": {
      "intent": "demographics",
      "entities": {
        "locations": ["Montana"],
        "demographics": ["uninsured rate"],
        "ageGroups": [],
        "incomeRanges": []
      },
      "filters": {
        "state": "Montana",
        "minUninsuredRate": 0.15
      },
      "confidence": 0.95,
      "sqlQuery": "SELECT state_name, county_name, population, uninsured_rate FROM block_group_data_expanded WHERE state_name = 'Montana' AND uninsured_rate > 0.15 ORDER BY uninsured_rate DESC LIMIT 100",
      "explanation": "This query identifies block groups in Montana with above-average uninsured rates (>15%)"
    },
    "post": {
      "insights": [
        "Montana's average uninsured rate in these block groups is 18.2%, which is 3.2% higher than the national average",
        "The highest uninsured rate (24.3%) is in rural census tract 30003000100",
        "Block groups with uninsured rates >20% tend to have median incomes below $45,000"
      ],
      "suggestedRefinements": [
        "Show me poverty rates in these Montana block groups",
        "Compare Montana's uninsured rates to neighboring states",
        "Filter to only show rural block groups in Montana"
      ],
      "dataQuality": {
        "completeness": 95.2,
        "recordCount": 15,
        "hasOutliers": false,
        "coverage": "15 of 900 Montana block groups"
      },
      "statisticalSummary": {
        "numericFields": {
          "uninsured_rate": {
            "min": 15.1,
            "max": 24.3,
            "avg": 18.2,
            "median": 17.8
          },
          "population": {
            "min": 543,
            "max": 1834,
            "avg": 1102,
            "median": 1045
          }
        },
        "context": "These areas represent 1.7% of Montana's block groups but contain 2.3% of the state's uninsured population"
      }
    }
  }
}
```

---

## Success Criteria

- ✅ All API responses include `reasoning` object
- ✅ Pre-query reasoning shows intent, entities, confidence
- ✅ Post-query insights provide 2-4 meaningful findings
- ✅ Statistical context is accurate and relevant
- ✅ Suggested refinements are actionable and clickable
- ✅ Data quality metrics are accurate
- ✅ UI is intuitive and doesn't overwhelm users
- ✅ Performance impact is minimal (<200ms added latency)

---

## Performance Considerations

1. **Caching:** Cache post-query analysis for identical result sets
2. **Async Loading:** Load insights after data is displayed
3. **Batching:** Generate insights for multiple queries in parallel
4. **Fallback:** If insight generation fails, still return data
5. **Rate Limiting:** Limit Claude API calls for insight generation

---

## Future Enhancements

- **Comparative Insights:** Compare to state/national averages automatically
- **Trend Detection:** Identify patterns across multiple queries
- **Export Reasoning:** Include reasoning in CSV/JSON exports
- **Reasoning History:** Show how query interpretations improve over time
- **Interactive SQL:** Allow users to edit generated SQL

---

## Related Documentation

- [Anthropic Messages API](https://docs.anthropic.com/en/api/messages)
- [CensusChat Query Flow](./docs/query-flow.md)
- [MCP Validation](./docs/mcp-validation.md)

---

**Next Steps:**
1. Review and approve this plan
2. Begin Phase 1 implementation
3. Set up testing environment
4. Create tracking issues for each phase
