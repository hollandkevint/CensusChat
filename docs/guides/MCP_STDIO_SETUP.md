# Use CensusChat from Claude Desktop (MCP stdio)

Query US Census demographics from Claude Desktop. No web app, no Docker, no
browser.

CensusChat ships an MCP server. It has two transports:

| Transport | Runs inside | Use it for |
|---|---|---|
| HTTP (Streamable) | the Express backend | the web app, Postman, remote clients |
| **stdio** | its own process | **Claude Desktop and other desktop MCP clients** |

This guide covers the stdio transport. Both transports expose the same tools
and enforce the same SQL security controls.

## What you get

Nine tools, all read-only against a local DuckDB file:

| Tool | Does |
|---|---|
| `get_information_schema` | lists tables, columns, and the active security policy |
| `validate_sql_query` | checks SQL against the security policy without running it |
| `execute_query` | validates, then runs, a `SELECT` |
| `execute_drill_down_query` | pages block groups inside one county |
| `execute_comparison_query` | same as `execute_query`, rendered as a bar chart |
| `execute_trend_query` | same as `execute_query`, rendered as a line chart |
| `generate_excel_report` | writes an Excel file from a result set |
| `generate_csv_report` | writes a CSV file from a result set |
| `generate_pdf_report` | writes a PDF from a result set |

Two tables: `county_data` (3,144 US counties) and `block_group_data_expanded`
(239,741 block groups, 84 variables).

## Prerequisites

1. **Node.js 20 or newer.** `node --version`.
2. **This repository, cloned locally.** The server is not on the npm registry.
   It is useless without a census database you build yourself, so a registry
   install would not save you a step.
3. **Backend dependencies installed:**
   ```bash
   cd CensusChat/backend
   npm ci
   ```
4. **A census DuckDB file.** Build it once:
   ```bash
   cd CensusChat/backend
   npm run load-blockgroups-expanded
   ```
   This calls the Census API and takes a while. It needs `CENSUS_API_KEY` in
   `backend/.env` — free from
   <https://api.census.gov/data/key_signup.html>. The result is
   `backend/data/census.duckdb`, roughly 170 MB.

**You do not need an `ANTHROPIC_API_KEY` for this path.** Claude Desktop is the
model. `ANTHROPIC_API_KEY` is only for the web app, which does its own natural
language to SQL translation. `CENSUS_API_KEY` is only for loading data, not for
querying it.

There is no account, login, or token. The server reads one local file.

## Build it

```bash
cd CensusChat/backend
npm run build
```

This produces `backend/dist/mcp/stdioServer.js`, which the config below points
at.

## Claude Desktop configuration

Edit your Claude Desktop config file:

- **macOS** — `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows** — `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux** — `~/.config/Claude/claude_desktop_config.json`

Add the `censuschat` entry. Replace both absolute paths with your own.

```json
{
  "mcpServers": {
    "censuschat": {
      "command": "node",
      "args": ["/absolute/path/to/CensusChat/backend/dist/mcp/stdioServer.js"],
      "env": {
        "DUCKDB_PATH": "/absolute/path/to/CensusChat/backend/data/census.duckdb"
      }
    }
  }
}
```

Both paths must be absolute. Claude Desktop does not run the server from your
shell, so `~` and relative paths do not resolve.

Restart Claude Desktop. The tools appear under the connectors icon.

### Running from source instead

To skip the build step during development:

```json
{
  "mcpServers": {
    "censuschat": {
      "command": "/absolute/path/to/CensusChat/backend/node_modules/.bin/ts-node",
      "args": ["/absolute/path/to/CensusChat/backend/src/mcp/stdioServer.ts"],
      "env": {
        "DUCKDB_PATH": "/absolute/path/to/CensusChat/backend/data/census.duckdb"
      }
    }
  }
}
```

Startup is a few seconds slower because `ts-node` compiles first.

## Try it

Ask Claude Desktop:

> Which 10 US counties have the highest median household income? Use CensusChat.

Claude writes the SQL, calls `execute_query`, and shows the rows. A direct
query looks like this:

```sql
SELECT county_name, state_name, population, median_income
FROM county_data
ORDER BY median_income DESC
LIMIT 10
```

## Security

The stdio transport uses the same validator as the HTTP transport
(`backend/src/validation/`). It is not a shortcut around it.

- `SELECT` only. `INSERT`, `UPDATE`, `DELETE`, `DROP`, and `ATTACH` are
  rejected before execution.
- Table and column allowlists. A query naming an unlisted column fails
  validation.
- A 1,000 row cap on every result.
- Blocked patterns: SQL comments, stacked statements, and known injection
  shapes.
- Every query is written to `backend/logs/sql-audit.log`.

A rejected query returns a validation error naming the rule it broke. Nothing
is executed.

## Troubleshooting

**"Census database not found" and the server exits.**
`DUCKDB_PATH` points at a file that does not exist. Check the path in your
config. DuckDB would otherwise create an empty database and every query would
fail with "table not found", so the server refuses to start instead. Build the
database with `npm run load-blockgroups-expanded`.

**Claude Desktop shows "server disconnected".**
Read Claude Desktop's MCP log
(`~/Library/Application Support/Claude/logs/mcp-server-censuschat.log` on
macOS). The usual causes are a wrong absolute path in `command` or `args`, or
`npm run build` never having been run.

**The tools do not appear.**
Restart Claude Desktop fully. It reads the config only at startup.

**`node: command not found` in the logs.**
Claude Desktop does not inherit your shell's PATH. Use the absolute path to
your node binary in `command` — `which node` gives it.

## Verifying without Claude Desktop

```bash
cd CensusChat/backend
DUCKDB_PATH=$(pwd)/data/census.duckdb npx ts-node scripts/verify-mcp-stdio.ts
```

This spawns the server exactly as a client would, lists the tools, runs a real
`SELECT`, and confirms a `DELETE` is rejected.

The automated tests in `backend/src/__tests__/mcp/stdioServer.test.ts` cover the
same path against a small generated fixture, so they need no census data:

```bash
cd CensusChat/backend
npm test -- stdioServer
```
