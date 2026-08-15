/**
 * CJS test shim for the ESM-only '@modelcontextprotocol/ext-apps/server' package.
 * Jest cannot parse the package's ESM bundle, so this shim re-implements the thin
 * helpers on top of the (CJS-compatible) MCP SDK McpServer API.
 */

const RESOURCE_URI_META_KEY = 'ui/resourceUri';
const RESOURCE_MIME_TYPE = 'text/html;profile=mcp-app';

function normalizeToolConfig(config) {
  const normalized = { ...config };
  if (normalized._meta && normalized._meta.ui && normalized._meta.ui.resourceUri) {
    normalized._meta = {
      ...normalized._meta,
      [RESOURCE_URI_META_KEY]: normalized._meta.ui.resourceUri,
    };
  }
  return normalized;
}

function registerAppTool(server, name, config, callback) {
  return server.registerTool(name, normalizeToolConfig(config), callback);
}

function registerAppResource(server, name, uri, config, readCallback) {
  return server.registerResource(
    name,
    uri,
    { mimeType: RESOURCE_MIME_TYPE, ...config },
    readCallback
  );
}

module.exports = {
  RESOURCE_URI_META_KEY,
  RESOURCE_MIME_TYPE,
  registerAppTool,
  registerAppResource,
};
