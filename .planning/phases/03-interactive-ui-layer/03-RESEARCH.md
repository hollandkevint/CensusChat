# Phase 3: Interactive UI Layer - Research

**Researched:** 2026-02-03
**Domain:** MCP Apps, TanStack Table, Recharts, Iframe Communication
**Confidence:** HIGH

## Summary

Phase 3 transforms CensusChat from returning static JSON to rendering interactive UI components directly in the chat. This requires implementing the MCP Apps extension (`@modelcontextprotocol/ext-apps` v1.0.1), which enables MCP tools to return UI resources rendered in sandboxed iframes. The frontend already has key dependencies (React 19, Recharts 3, Tailwind 4, Lucide icons) but needs TanStack Table for data grids and an App Bridge for iframe communication.

The MCP Apps pattern is "Tool + UI Resource": each tool declares a `_meta.ui.resourceUri` pointing to a `ui://` scheme resource. The host (Next.js frontend) fetches this HTML resource from the MCP server, renders it in a sandboxed iframe, and proxies bidirectional JSON-RPC communication via postMessage. The UI (View) can call server tools, receive results, and send messages back to the chat.

**Primary recommendation:** Install `@modelcontextprotocol/ext-apps@1.0.1` on backend and frontend, create a Vite build pipeline for single-file HTML Apps, implement TanStack Table for sortable/filterable data grids, and add an App Bridge component to the Next.js frontend for iframe rendering.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @modelcontextprotocol/ext-apps | 1.0.1 | MCP Apps SDK for UI resources | Official MCP extension, released Jan 26 2026 |
| @tanstack/react-table | 8.21.3 | Headless data table (sorting, filtering, pagination) | Industry standard, 27.7k stars, React 19 compatible |
| recharts | 3.1.0 | Bar and line charts | Already installed, D3-based, composable |
| vite | 6.x | Build pipeline for MCP Apps | Fast, supports single-file output |
| vite-plugin-singlefile | 2.x | Bundle HTML/JS/CSS into single file | Required for MCP Apps resources |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 0.535.0 | Icons (already installed) | Drill-down chevrons, export icons |
| zustand | 5.0.7 | State management (already installed) | Table/chart state coordination |
| clsx | 2.1.1 | Class merging (already installed) | Conditional Tailwind classes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack Table | MUI X Data Grid | MUI adds 200KB+ bundle, TanStack is headless/lightweight |
| Recharts | Chart.js | Recharts is already installed, more React-native |
| Vite single-file | Webpack | Vite is faster, native single-file plugin support |
| App Bridge SDK | Custom postMessage | SDK handles protocol edge cases, security |

**Installation:**
```bash
# Backend
cd backend && npm install @modelcontextprotocol/ext-apps@1.0.1

# Frontend
cd frontend && npm install @tanstack/react-table@8.21.3 @modelcontextprotocol/ext-apps@1.0.1

# Build tooling (separate mcp-apps directory)
npm install -D vite vite-plugin-singlefile typescript
```

## Architecture Patterns

### Recommended Project Structure
```
backend/src/
├── mcp/
│   ├── mcpServer.ts              # Add UI resource registration
│   ├── mcpApps/                   # NEW: MCP Apps build output
│   │   ├── data-table.html        # Bundled sortable table app
│   │   ├── bar-chart.html         # Bundled bar chart app
│   │   └── line-chart.html        # Bundled line chart app
│   └── mcpToolHandlers.ts        # Add _meta.ui.resourceUri to tools

mcp-apps/                          # NEW: Source for MCP Apps
├── vite.config.ts                 # Single-file build config
├── src/
│   ├── data-table/
│   │   ├── index.html
│   │   └── main.tsx              # TanStack Table + App class
│   ├── bar-chart/
│   │   └── main.tsx              # Recharts BarChart + App class
│   └── line-chart/
│       └── main.tsx              # Recharts LineChart + App class
└── package.json

frontend/src/
├── components/
│   ├── ChatInterface.tsx         # Modify to detect UI resources
│   ├── AppBridge.tsx             # NEW: Iframe renderer + message proxy
│   ├── DataTable/                # NEW: Non-MCP sortable table fallback
│   │   ├── DataTable.tsx
│   │   └── columns.tsx
│   └── Charts/                   # NEW: Non-MCP chart components
│       ├── BarChart.tsx
│       └── LineChart.tsx
```

### Pattern 1: MCP Apps Registration
**What:** Register tools with UI resources via `_meta.ui.resourceUri`
**When to use:** Every tool that should render interactive results
**Example:**
```typescript
// Source: @modelcontextprotocol/ext-apps quickstart
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps';
import { readFileSync } from 'fs';

// Register tool with UI linkage
registerAppTool(server, 'execute_query', {
  title: 'Execute Census Query',
  description: 'Execute validated SQL and return interactive results',
  inputSchema: { query: z.string() },
  _meta: {
    ui: {
      resourceUri: 'ui://censuschat/data-table.html',
      visibility: ['model', 'app']  // Available to both AI and UI
    }
  }
}, async (args) => {
  const result = await handleExecuteQuery(args.query);
  return result;
});

// Register the UI resource
const dataTableHtml = readFileSync('./mcpApps/data-table.html', 'utf-8');
registerAppResource(
  server,
  'ui://censuschat/data-table.html',
  'ui://censuschat/data-table.html',
  { mimeType: RESOURCE_MIME_TYPE },
  async () => ({ text: dataTableHtml })
);
```

### Pattern 2: View Implementation with App Class
**What:** MCP App that connects to host, receives data, renders UI
**When to use:** Each interactive component (table, chart)
**Example:**
```typescript
// Source: @modelcontextprotocol/ext-apps SDK
import { App } from '@modelcontextprotocol/ext-apps';

const app = new App({
  name: 'CensusChat Data Table',
  version: '1.0.0'
});

// Receive tool results from host
app.ontoolresult = (result) => {
  if (result.success && result.data) {
    renderTable(result.data);
  }
};

// Handle drill-down click
async function handleDrillDown(countyFips: string) {
  const blockGroups = await app.callServerTool({
    name: 'execute_query',
    arguments: {
      query: `SELECT * FROM block_group_data_expanded
              WHERE county_fips = '${countyFips}' LIMIT 100`
    }
  });
  renderTable(blockGroups.data);
}

// Connect to host
app.connect();
```

### Pattern 3: App Bridge in Next.js Host
**What:** React component that renders MCP App iframes and proxies messages
**When to use:** ChatInterface when message contains UI resource
**Example:**
```typescript
// Source: @modelcontextprotocol/ext-apps basic-host example
import { useEffect, useRef, useState } from 'react';

interface AppBridgeProps {
  resourceUri: string;
  resourceHtml: string;
  toolResult: any;
  onMessage?: (message: any) => void;
}

export function AppBridge({ resourceUri, resourceHtml, toolResult, onMessage }: AppBridgeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from our iframe
      if (event.source !== iframeRef.current?.contentWindow) return;

      const { method, params, id } = event.data;

      if (method === 'ui/ready') {
        setReady(true);
        // Send tool result to app
        iframeRef.current?.contentWindow?.postMessage({
          jsonrpc: '2.0',
          method: 'ui/notifications/tool-result',
          params: toolResult
        }, '*');
      }

      if (method === 'ui/message') {
        onMessage?.(params);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [toolResult, onMessage]);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={resourceHtml}
      sandbox="allow-scripts"
      className="w-full h-96 border rounded-lg"
    />
  );
}
```

### Pattern 4: Cursor-Based Pagination for Large Datasets
**What:** Paginate using row identifiers instead of OFFSET
**When to use:** Block group queries (239K rows)
**Example:**
```typescript
// Source: DuckDB + general best practices
// DON'T use OFFSET for large datasets
const badQuery = `SELECT * FROM block_group_data_expanded OFFSET 10000 LIMIT 100`;

// DO use cursor-based pagination with indexed column
const goodQuery = `
  SELECT * FROM block_group_data_expanded
  WHERE geoid > '${lastGeoid}'
  ORDER BY geoid
  LIMIT 100
`;

// Server-side: Track cursor in response metadata
interface PaginatedResponse {
  data: any[];
  metadata: {
    rowCount: number;
    hasMore: boolean;
    nextCursor: string;  // Last geoid for next page
  };
}
```

### Pattern 5: TanStack Table with Sorting and Filtering
**What:** Headless table with client-side sort/filter
**When to use:** Data tables under 10K rows (client-side)
**Example:**
```typescript
// Source: TanStack Table docs
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  SortingState,
  ColumnFiltersState
} from '@tanstack/react-table';

function DataTable({ data, columns }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <table>
      <thead>
        {table.getHeaderGroups().map(headerGroup => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map(header => (
              <th
                key={header.id}
                onClick={header.column.getToggleSortingHandler()}
                className="cursor-pointer"
              >
                {flexRender(header.column.columnDef.header, header.getContext())}
                {{
                  asc: ' ^',
                  desc: ' v',
                }[header.column.getIsSorted() as string] ?? ''}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map(row => (
          <tr key={row.id}>
            {row.getVisibleCells().map(cell => (
              <td key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### Anti-Patterns to Avoid
- **OFFSET pagination for large datasets:** Scans and skips rows, O(n) for each page
- **React Compiler with TanStack Table 8.x:** Known re-render bugs, disable compiler for table components
- **Unsandboxed iframes:** MCP Apps MUST use `sandbox="allow-scripts"`, no allow-same-origin
- **Direct DOM manipulation in Apps:** Use React/framework state, not document.querySelector
- **Fetching UI resources on every render:** Cache HTML resources, only fetch once per session

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Iframe message protocol | Custom postMessage handling | `@modelcontextprotocol/ext-apps` App class | Handles JSON-RPC, ready state, errors |
| Sortable table headers | onClick + array.sort | TanStack Table getSortedRowModel | Handles stable sort, multi-column, direction |
| Column filtering UI | Custom input + filter | TanStack Table getFilteredRowModel | Handles string/number/date types |
| Responsive charts | CSS media queries + resize | Recharts ResponsiveContainer | Handles resize observer, debounce |
| Single-file HTML bundle | Custom webpack config | vite-plugin-singlefile | Handles CSS inlining, asset embedding |
| Server-side pagination | DIY cursor tracking | Standardized cursor response format | Handles edge cases, consistent API |

**Key insight:** The MCP Apps SDK handles the complex iframe security model and bidirectional communication. Rolling your own postMessage protocol will miss edge cases like initialization races, message ordering, and error propagation.

## Common Pitfalls

### Pitfall 1: TanStack Table + React 19 Compiler
**What goes wrong:** Table doesn't re-render when data changes
**Why it happens:** React Compiler optimizes away necessary re-renders in TanStack Table v8
**How to avoid:** Disable React Compiler for table components or wait for TanStack Table v9
**Warning signs:** Data updates but table shows stale rows

### Pitfall 2: MCP App Iframe Sandbox Too Restrictive
**What goes wrong:** Scripts don't run, app shows blank
**Why it happens:** Missing `allow-scripts` in sandbox attribute
**How to avoid:** Use exactly `sandbox="allow-scripts"` - no more, no less
**Warning signs:** Iframe loads HTML but no interactivity

### Pitfall 3: UI Resource Not Found
**What goes wrong:** 404 error when host fetches ui:// resource
**Why it happens:** Resource not registered on server, or registered after tool
**How to avoid:** Register resources BEFORE registering tools that reference them
**Warning signs:** Tool works but UI doesn't render

### Pitfall 4: OFFSET Pagination Performance
**What goes wrong:** Page 100+ takes 5+ seconds to load
**Why it happens:** DuckDB scans and discards N rows for OFFSET N
**How to avoid:** Use cursor-based pagination with indexed column (geoid)
**Warning signs:** First pages fast, later pages progressively slower

### Pitfall 5: Recharts ResponsiveContainer Min-Height
**What goes wrong:** Chart renders at 0 height, invisible
**Why it happens:** ResponsiveContainer needs explicit min-height on parent
**How to avoid:** Always set `min-h-[VALUE]` on chart container
**Warning signs:** Chart data loads but nothing visible

### Pitfall 6: postMessage Origin Validation
**What goes wrong:** Messages from other iframes accepted, security vulnerability
**Why it happens:** Checking event.origin against '*' or not checking at all
**How to avoid:** Compare event.source against iframe.contentWindow reference
**Warning signs:** Unexpected messages in handler

## Code Examples

Verified patterns from official sources:

### Vite Config for Single-File MCP App
```typescript
// Source: vite-plugin-singlefile docs
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    target: 'esnext',
    assetsInlineLimit: 100000000,  // Inline everything
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
```

### Drill-Down Navigation (County to Block Groups)
```typescript
// In MCP App View
async function handleCountyClick(countyFips: string, countyName: string) {
  // Show loading state
  setLoading(true);

  // Call server tool via App Bridge
  const result = await app.callServerTool({
    name: 'execute_query',
    arguments: {
      query: `
        SELECT geoid, total_population, median_household_income,
               pct_65_and_over, pct_with_health_insurance
        FROM block_group_data_expanded
        WHERE county_fips = '${countyFips}'
        ORDER BY total_population DESC
        LIMIT 100
      `
    }
  });

  // Update breadcrumb navigation
  setBreadcrumbs(prev => [...prev, { fips: countyFips, name: countyName }]);

  // Render new data
  setData(result.data);
  setLoading(false);
}
```

### Export Controls in MCP App
```typescript
// In MCP App View - export without server roundtrip
function ExportControls({ data, columns }: { data: any[], columns: Column[] }) {
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    columns.map(c => c.id)
  );
  const [format, setFormat] = useState<'csv' | 'excel'>('csv');

  const handleExport = () => {
    const filteredData = data.map(row =>
      Object.fromEntries(
        selectedColumns.map(col => [col, row[col]])
      )
    );

    if (format === 'csv') {
      const csv = convertToCSV(filteredData);
      downloadBlob(csv, 'census-export.csv', 'text/csv');
    } else {
      // Signal host to handle Excel export
      app.sendMessage({ type: 'export', format: 'excel', data: filteredData });
    }
  };

  return (
    <div className="flex gap-2 items-center">
      <select value={format} onChange={e => setFormat(e.target.value as any)}>
        <option value="csv">CSV</option>
        <option value="excel">Excel</option>
      </select>
      <ColumnPicker columns={columns} selected={selectedColumns} onChange={setSelectedColumns} />
      <button onClick={handleExport}>Export</button>
    </div>
  );
}
```

### Recharts Bar Chart for Demographics
```typescript
// Source: Recharts examples
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function DemographicBarChart({ data }: { data: DemographicComparison[] }) {
  return (
    <div className="min-h-[400px]">
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip formatter={(value: number) => value.toLocaleString()} />
          <Legend />
          <Bar dataKey="total_population" fill="#8884d8" name="Total Population" />
          <Bar dataKey="population_65_plus" fill="#82ca9d" name="65+ Population" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static JSON responses | MCP Apps with UI resources | Jan 26, 2026 | Interactive results in chat |
| Custom postMessage | App Bridge SDK | Jan 26, 2026 | Standardized iframe protocol |
| OFFSET pagination | Cursor-based pagination | N/A | O(1) vs O(n) page fetching |
| react-table v7 | TanStack Table v8 | 2022 | Headless, TypeScript-first |

**Deprecated/outdated:**
- **Static renderDataTable in ChatInterface:** Replace with AppBridge + MCP Apps
- **ExportButton separate from results:** Move export controls into MCP App View
- **Inline data limits (10 rows):** TanStack Table handles large datasets with virtualization

## Open Questions

Things that couldn't be fully resolved:

1. **React Compiler + TanStack Table Compatibility**
   - What we know: Known bug in TanStack Table 8.x with React 19 Compiler
   - What's unclear: When fix will ship (could be Table v9 or compiler update)
   - Recommendation: Disable React Compiler for table components via `use no memo`

2. **Chart Type Auto-Selection**
   - What we know: Bar for comparisons, line for trends
   - What's unclear: How to detect query intent (comparison vs trend)
   - Recommendation: Use simple heuristics (time columns = line, geography = bar) for v1

3. **Maximum Inline Data Size**
   - What we know: MCP Apps pass data via postMessage
   - What's unclear: Browser limits on structured clone size
   - Recommendation: Limit to 10K rows inline, paginate beyond

4. **Vite Build in Monorepo**
   - What we know: MCP Apps need separate build from Next.js
   - What's unclear: Best way to integrate build output into backend
   - Recommendation: Separate `mcp-apps/` directory with npm script to copy output

## Sources

### Primary (HIGH confidence)
- [MCP Apps Specification](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx) - UI resource protocol
- [MCP Apps SDK Quickstart](https://modelcontextprotocol.github.io/ext-apps/api/documents/Quickstart.html) - Installation and setup
- [MCP Apps Overview](https://modelcontextprotocol.github.io/ext-apps/api/documents/Overview.html) - Architecture
- [TanStack Table GitHub](https://github.com/TanStack/table) - Version 8.21.3, React 19 status
- [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile) - Bundle config

### Secondary (MEDIUM confidence)
- [MCP Apps Blog Announcement](http://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/) - Feature overview
- [WorkOS MCP Apps Tutorial](https://workos.com/blog/2026-01-27-mcp-apps) - Implementation patterns
- [TanStack Table React 19 Issue](https://github.com/TanStack/table/issues/5567) - Compiler compatibility
- [Recharts ResponsiveContainer](https://www.dhiwise.com/post/simplify-data-visualization-with-recharts-responsivecontainer) - Setup guide

### Tertiary (LOW confidence)
- [DuckDB OFFSET Performance Discussion](https://github.com/duckdb/duckdb/issues/14218) - Pagination alternatives
- [shadcn/ui Recharts v3 Status](https://ui.shadcn.com/docs/components/chart) - React 19 notes

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official MCP extension, npm packages verified
- Architecture: HIGH - MCP Apps spec, SDK documentation
- Pitfalls: MEDIUM - Mix of official docs and community reports
- Code examples: HIGH - From official SDK and library docs

**Research date:** 2026-02-03
**Valid until:** 2026-03-03 (30 days - MCP Apps v1.0.1 stable)
