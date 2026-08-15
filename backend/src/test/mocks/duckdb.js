/**
 * CJS test shim for the legacy 'duckdb' package, which is no longer a project
 * dependency (the app uses '@duckdb/node-api'). Several older test suites call
 * jest.mock('duckdb', factory); this stub only exists so that module resolution
 * succeeds — the jest.mock factories supply the actual behavior.
 */

class Database {
  constructor() {
    throw new Error(
      "The 'duckdb' package is not installed; tests must mock it via jest.mock('duckdb', factory)."
    );
  }
}

module.exports = { Database };
module.exports.default = module.exports;
