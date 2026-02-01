# Coding Conventions

**Analysis Date:** 2026-02-01

## Naming Patterns

**Files:**
- Backend services: camelCase (e.g., `excelExportService.ts`, `cacheService.ts`)
- Backend routes: kebab-case (e.g., `query.routes.ts`, `export.routes.ts`)
- Frontend components: PascalCase (e.g., `ChatInterface.tsx`, `ExportButton.tsx`)
- Frontend hooks: camelCase with `use` prefix (e.g., `useExport.ts`)
- Types/interfaces: PascalCase in separate files (e.g., `query.models.ts`, `export.models.ts`)
- Test files: match source file name with `.test.ts` or `.spec.ts` suffix (e.g., `duckdbPool.test.ts`)

**Functions:**
- Async functions explicitly use `async` keyword: `async functionName(): Promise<ReturnType>`
- Private methods prefixed with underscore: `private _helperMethod()`
- Public methods: camelCase without underscore
- Utility functions: exported as named functions or static methods
- Handlers/callbacks: named with pattern `handle*` or `on*` (e.g., `handleSendMessage`, `onSuccess`)

**Variables:**
- Constants: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_TTL`, `MAX_CONNECTIONS`, `CHUNK_SIZE`)
- Boolean variables: prefixed with `is` or `has` (e.g., `isExporting`, `cacheAvailable`)
- State variables in React: camelCase (e.g., `setMessages`, `setIsProcessing`)
- Configuration maps: camelCase (e.g., `CACHE_CONFIG`, `CircuitBreakerOptions`)

**Types:**
- Interfaces: PascalCase with optional `I` prefix (used inconsistently; `I` not required)
- Example: `QueryResponse`, `ExportRequest`, `CircuitBreakerOptions`
- Generic types: single uppercase letter for simple cases (e.g., `<T>`)
- Enum values: UPPER_SNAKE_CASE (e.g., `CircuitState.OPEN`, `CircuitState.HALF_OPEN`)

## Code Style

**Formatting:**
- No explicit Prettier config found; Next.js uses defaults
- Backend uses implicit standard formatting via TypeScript
- Line length: appears to follow standard 80-120 character guidelines
- Import organization: groups external, then internal, then relative imports

**Linting:**
- Backend: ESLint 9.32.0 with TypeScript support (`@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`)
- Frontend: Next.js ESLint config (flat config via `eslint.config.mjs`)
- Run command: `npm run lint` (backend: `eslint src/**/*.ts`, frontend: `next lint`)

**TypeScript Strictness:**
- Backend: `strict: false` (temporarily disabled for demo - noted in `tsconfig.json`)
- Enabled: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- Disabled: `noImplicitReturns` (temporarily disabled)
- Frontend: `strict: true` - full TypeScript strict mode enabled
- Target: ES2022 (backend), ES2017 (frontend)

## Import Organization

**Order:**
1. External packages (`express`, `dotenv`, `@anthropic-ai/sdk`)
2. Local modules (config, services, models)
3. Utilities (`./utils`)
4. Types and interfaces
5. Relative imports from same directory

**Path Aliases:**
- Backend: `@/` maps to `src/` in `jest.config.js`
- Backend test alias: `@test/` maps to `src/test/`
- Frontend: `@/*` maps to `src/*` in `tsconfig.json`

Example (backend service):
```typescript
import Redis from 'ioredis';
import { config } from '../config';
import { CensusApiResponse, CensusQuery } from './censusApiService';
```

## Error Handling

**Custom Error Classes:**
- `AppError` extends `Error`: class-based with `statusCode`, `message`, and `isOperational` properties
- Location: `backend/src/middleware/errorHandler.ts`
- Pattern: Constructor takes `statusCode`, `message`, and optional `isOperational` flag

**Frontend Error Pattern:**
- `QueryApiError` extends `Error`: includes `status`, `errorCode`, and optional `suggestions`
- Location: `frontend/src/lib/api/queryApi.ts`
- Pattern: Wraps API errors with contextual information for user display

**Error Handling Strategy:**
- Middleware: `errorHandler` middleware (Express) catches all errors
- Development: Includes stack traces in response when `isDevelopment` is true
- Production: Strips stack traces, returns only message and status code
- Error logging: JSON format with request context (URL, method, IP, timestamp)

**Circuit Breaker Pattern:**
- Class-based implementation in `backend/src/utils/circuitBreaker.ts`
- States: `CLOSED` (normal), `OPEN` (rejecting), `HALF_OPEN` (testing recovery)
- Threshold-based: opens after N failures within monitor window
- Auto-reset: schedules transition from OPEN to HALF_OPEN after timeout

## Logging

**Framework:** `console` object (not a dedicated logging library)

**Patterns:**
- Console.log for info (prefixed with emoji like `🚀`, `✅`)
- Console.error for errors (prefixed with `❌`, `🚨`)
- Console.warn for warnings (prefixed with `⚠️`)
- Suppressed during tests (see `backend/src/test/setup.ts`)
- Structured errors include request context: `{ error, stack, url, method, ip, timestamp }`

**Examples:**
```typescript
console.log(`✅ Redis connected for caching`);
console.warn(`⚠️ Circuit breaker [${this.name}] recorded failure`);
console.error(`🚨 Circuit breaker [${this.name}] OPENED due to failures`);
```

## Comments

**When to Comment:**
- Rare in codebase; comments mainly document non-obvious logic
- Configuration comments explain conditional logic (e.g., `// Ensure temp directory exists`)
- Setup comments clarify initialization steps (e.g., `// Load environment variables FIRST before any other imports`)

**JSDoc/TSDoc:**
- Minimal usage; not systematically applied
- Some function parameters documented in type signatures
- Backend uses type annotations as primary documentation mechanism
- No dedicated documentation generation (no TypeDoc config)

**Example:**
```typescript
/**
 * Generate cache key from Census query parameters
 */
export function generateCacheKey(query: CensusQuery): string {
```

## Function Design

**Size Guidelines:**
- Range: 10-50 lines typical; larger functions broken into private helpers
- Example: `excelExportService.ts` methods stay under 60 lines by delegating to private methods like `_createStreamingExcel`

**Parameters:**
- Functions accept 1-3 parameters; 4+ use object destructuring or dedicated model types
- Optional params use `?:` suffix in TypeScript
- Callbacks and handlers use consistent function signatures

**Return Values:**
- Async functions always return `Promise<T>`
- Error cases throw custom error classes rather than returning null
- Successful results returned directly (not wrapped in `{ success: true, data: ... }` pattern in pure functions)
- API responses use object wrapper for consistency

## Module Design

**Exports:**
- Backend services: class-based singletons exported with factory function
  - Example: `getMCPServerService()` returns singleton instance
  - Cleanup: corresponding `closeMCPServerService()` function for resource cleanup

- Utilities: mixed export styles
  - Named function exports: `export function generateCacheKey()`
  - Class exports: `export class CircuitBreaker`
  - Singleton-like: `export const queryApi = { ... }`

**Barrel Files:**
- Used strategically in `backend/src/modules/healthcare_analytics/index.ts`
- Backend routes: central registration in `backend/src/routes/index.ts`
- Frontend: no barrel files; direct imports from component files

**Patterns:**
- Services: instantiation handled once, re-used as singletons
- Utilities: stateless functions or classes with state encapsulation
- React components: functional components with hooks (no class components)
- Frontend hooks: custom hooks follow React conventions (`useCallback`, `useState`)

## Async/Await

**Pattern:**
- Explicit `async` keyword on all async functions
- No callback hell or `.then()` chains
- Try/catch for error handling in async contexts
- Promises explicitly typed: `Promise<ReturnType>`

**Example:**
```typescript
async exportToExcel(
  queryResult: QueryResultForExport,
  request: ExportRequest
): Promise<ExportResponse> {
  try {
    // Async operations
  } catch (error) {
    // Error handling
  }
}
```

## Testing Considerations

- Backend: Strict TypeScript compilation per tests ensures type safety
- Frontend: React Testing Library used; component tests follow standard patterns
- Mock setup: `jest.mock()` at test file top for module mocking
- Fixture data: separate files in `backend/src/test/fixtures/` and `backend/src/test/helpers/`

---

*Convention analysis: 2026-02-01*
