# CensusChat MCP Tools

## Overview

CensusChat exposes its functionality through Model Context Protocol (MCP) tools. The MCP server runs at `http://localhost:3001/mcp` and provides tools for schema inspection, SQL validation, query execution, data visualization, and document generation.

---

## `get_information_schema`

**Description:** Get database schema information including tables, columns, and security policies.

**Parameters:** None

**When to use:** Call this tool at the start of a session to confirm available tables, columns, and security constraints. Use the response to guide SQL generation.

**Returns:** JSON object with:
- `schema` - All tables and their columns from the CENSUS_SCHEMA definition
- `security_policy` - Active security policies including allowed tables, column allowlists, and row limits

---

## `validate_sql_query`

**Description:** Validate a SQL query against security policies without executing it.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | SQL query to validate |

**When to use:** Always call this before executing a query to ensure it passes security validation. This catches unauthorized tables, blocked columns, forbidden patterns (DROP, DELETE, comments, etc.), and enforces the 1,000-row limit.

**Returns:** JSON object with:
- `valid` - Boolean indicating whether the query passes validation
- `errors` - Array of validation error objects (if invalid)
- `sanitizedSQL` - The query with an enforced LIMIT clause (if valid)
- `tables` - Tables referenced in the query
- `columns` - Columns referenced in the query

---

## `execute_query`

**Description:** Validate and execute a SQL query on the census database. Results can be displayed in an interactive data table.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | SQL SELECT query to execute |

**When to use:** Use for general-purpose census data queries. The tool validates the SQL first, then executes it against DuckDB. Results are rendered in an interactive data table UI when available.

**Returns:** JSON object with:
- `success` - Boolean
- `data` - Array of result rows
- `metadata.rowCount` - Number of rows returned
- `metadata.hasMore` - Whether additional rows exist beyond the limit
- `metadata.nextCursor` - Cursor value for pagination (geoid or county_fips of last row)
- `metadata.tables` - Tables used in the query
- `metadata.columns` - Columns used in the query

---

## `execute_drill_down_query`

**Description:** Execute a drill-down query to retrieve block groups within a county. Results are paginated using cursor-based navigation.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `countyFips` | string | Yes | County FIPS code (5 digits: 2 state + 3 county) |
| `cursor` | string | No | Cursor for pagination (geoid of last row from previous page) |

**When to use:** Use when the user wants to drill down from county-level data into block group detail for a specific county. Returns 100 block groups per page with cursor-based pagination.

**Returns:** JSON object with:
- `success` - Boolean
- `data` - Array of block group records (geoid, name, total_population, median_household_income, pct_65_and_over, pct_with_health_insurance)
- `metadata.rowCount` - Number of rows in this page
- `metadata.hasMore` - Whether more pages exist
- `metadata.nextCursor` - Geoid to pass as cursor for next page
- `metadata.countyFips` - The county FIPS code queried

---

## `execute_comparison_query`

**Description:** Execute a SQL query for demographic comparison and display as a bar chart. Best for comparing categories (regions, demographics, etc.) with numeric values.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | SQL SELECT query comparing categories with numeric values |

**When to use:** Use when the user asks to compare demographics across multiple counties, states, or categories. The results are rendered as a bar chart visualization. The query should return a categorical column and one or more numeric columns.

**Returns:** Same structure as `execute_query`. Results are displayed as a bar chart when the UI resource is available.

---

## `execute_trend_query`

**Description:** Execute a SQL query for trend analysis and display as a line chart. Best for time-series data with numeric values.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | SQL SELECT query with time-series data and numeric values |

**When to use:** Use when the user asks about trends over time. The query should return a date/time/year column and one or more numeric columns. Results are rendered as a line chart.

**Returns:** Same structure as `execute_query`. Results are displayed as a line chart when the UI resource is available.

---

## `generate_excel_report`

**Description:** Generate an Excel spreadsheet from query results. Returns base64-encoded file content.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `data` | array | Yes | Array of data records to include in the spreadsheet |
| `filename` | string | No | Filename without extension (default: "census_export") |
| `title` | string | No | Title for the report |
| `includeMetadata` | boolean | No | Whether to include a metadata row (default: true) |
| `columns` | array of strings | No | Columns to include (default: all) |

**When to use:** Use when the user asks to export or download data as an Excel file.

---

## `generate_csv_report`

**Description:** Generate a CSV file from query results. Returns the CSV content as text.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `data` | array | Yes | Array of data records to include |
| `filename` | string | No | Filename without extension (default: "export") |
| `columns` | array of strings | No | Columns to include (default: all) |

**When to use:** Use when the user asks for CSV export or needs a simple text-based data format.

---

## `generate_pdf_report`

**Description:** Generate a PDF report from query results. Returns base64-encoded file content.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `data` | array | Yes | Array of data records to include |
| `title` | string | No | Report title |
| `filename` | string | No | Filename without extension (default: "census_report") |
| `columns` | array of strings | No | Columns to include (default: all, max 5 displayed) |

**When to use:** Use when the user asks for a PDF report. Note that PDF output is limited to 5 columns and 50 rows per page for readability.

---

## Recommended Tool Usage Flow

1. Call `get_information_schema` once at session start to understand available data.
2. Translate the user's natural language query into SQL.
3. Call `validate_sql_query` to check the SQL against security policies.
4. If valid, call the appropriate execution tool:
   - `execute_query` for general data retrieval
   - `execute_comparison_query` for side-by-side comparisons (bar chart)
   - `execute_trend_query` for time-series analysis (line chart)
   - `execute_drill_down_query` for county-to-block-group exploration
5. If the user requests an export, call `generate_excel_report`, `generate_csv_report`, or `generate_pdf_report` with the result data.
