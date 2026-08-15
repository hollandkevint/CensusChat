/**
 * CJS test shim for the ESM-only '@anthropic-ai/claude-agent-sdk' package.
 * Jest cannot parse the package's ESM output. Tests that exercise the agent
 * mock this module explicitly (jest.mock); this shim only needs to make the
 * import resolvable for suites that import the app but never run the agent.
 */

async function* emptyStream() {
  // No messages; real behavior is provided via jest.mock in agent tests.
}

function query() {
  return emptyStream();
}

module.exports = { query };
