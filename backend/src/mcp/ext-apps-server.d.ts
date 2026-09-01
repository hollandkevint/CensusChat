/**
 * Ambient type mapping for the `@modelcontextprotocol/ext-apps/server` subpath.
 *
 * The package exposes `./server` via its package.json `exports` field, which
 * Node resolves at runtime. TypeScript's classic `moduleResolution: node`
 * does not read `exports`, so it cannot locate the subpath's declarations.
 * This maps the import specifier to the real `.d.ts` without touching runtime
 * behavior (types only).
 */
declare module '@modelcontextprotocol/ext-apps/server' {
  export * from '@modelcontextprotocol/ext-apps/dist/src/server/index';
}
