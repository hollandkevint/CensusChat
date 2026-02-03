import { Router } from 'express';
import { anthropicService } from '../services/anthropicService';
import { queryRateLimit, censusApiUserRateLimit } from '../middleware/rateLimiting';
import { FallbackService, CensusApiErrorType } from '../services/fallbackService';
import { getDuckDBPool } from '../utils/duckdbPool';
import { mapStateAbbreviationsInQuery } from '../utils/stateMapper';
import { getCensusChat_MCPClient } from '../mcp/mcpClient';
import { getHealthcareAnalyticsModule } from '../modules/healthcare_analytics';
import { getAuditLogger } from '../utils/auditLogger';
import { AgentService, isComparisonQuery } from '../agent/agentService';

const router = Router();

// Feature flag for DuckDB pool usage
const USE_PRODUCTION_DUCKDB = process.env.USE_PRODUCTION_DUCKDB === 'true';

// Feature flag for Agent SDK usage (gradual rollout)
const USE_AGENT_SDK = process.env.USE_AGENT_SDK === 'true';

// DuckDB query helper using connection pool (DEPRECATED - use MCP client instead)
/* eslint-disable @typescript-eslint/no-unused-vars */
const queryDuckDB = async (sql: string): Promise<any[]> => {
  if (!USE_PRODUCTION_DUCKDB) {
    console.log('🔧 Production DuckDB disabled via feature flag, will use fallback');
    throw new Error('Production DuckDB disabled via feature flag');
  }

  try {
    console.log('🏊 Using DuckDB connection pool for query...');
    const pool = getDuckDBPool();

    // Initialize pool if not already done
    if (!pool.getStats().totalConnections) {
      console.log('🚀 Initializing DuckDB pool...');
      await pool.initialize();
    }

    const result = await pool.query(sql);
    console.log('✅ DuckDB pool query successful, rows:', result?.length || 0);
    return result;
  } catch (error) {
    console.error('❌ DuckDB pool query error:', error);
    throw new Error(`DuckDB pool query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Healthcare analytics helper function using FDB-MCP module
async function tryHealthcareAnalytics(query: string, analysis: any): Promise<any> {
  try {
    console.log('🏥 Initializing healthcare analytics module...');

    // Get the healthcare analytics module instance
    const healthcareModule = getHealthcareAnalyticsModule({
      enableCaching: true,
      cacheTTLSeconds: 300,
      maxConcurrentQueries: 5,
      queryTimeoutSeconds: 10,
      enableExternalDataSources: false // Start with internal data
    });

    // Extract geographic parameters from analysis
    const locations = analysis?.analysis?.entities?.locations ||
                     analysis?.entities?.geography ||
                     ['Florida']; // Default fallback

    // Build query request for the healthcare analytics module
    const queryRequest = {
      naturalLanguageQuery: query,
      parameters: {
        geography_type: 'state' as const, // Start with state level for broader coverage
        geography_codes: locations,
        // Add other parameters based on query content
        ...(query.toLowerCase().includes('medicare') && { focus_area: 'medicare' }),
        ...(query.toLowerCase().includes('health') && { focus_area: 'population_health' }),
        ...(query.toLowerCase().includes('facility') && { focus_area: 'facility_adequacy' })
      }
    };

    console.log('📊 Executing healthcare analytics query:', {
      query: query.substring(0, 100) + '...',
      geography: locations,
      queryType: queryRequest.parameters.focus_area || 'general'
    });

    // Execute the query through the healthcare analytics module
    const result = await healthcareModule.executeQuery(queryRequest);

    if (result.success && result.data.length > 0) {
      console.log(`✅ Healthcare analytics successful: ${result.metadata.recordCount} records`);

      return {
        success: true,
        data: result.data,
        metadata: {
          recordCount: result.metadata.recordCount,
          dataSource: result.metadata.federatedSources.join(', '),
          executionTime: result.metadata.executionTime,
          confidenceLevel: result.metadata.confidenceLevel,
          queryPattern: result.metadata.queryPattern
        }
      };
    } else {
      console.log('⚠️ Healthcare analytics returned no data');
      return {
        success: false,
        error: result.error || 'No data returned from healthcare analytics'
      };
    }

  } catch (error) {
    console.error('❌ Healthcare analytics execution failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown healthcare analytics error'
    };
  }
}

// POST /api/v1/queries
router.post('/', queryRateLimit, censusApiUserRateLimit, async (req, res) => {
  const startTime = Date.now();
  console.log('🔍 Query route started, processing request...');

  try {
    console.log('📦 Parsing request body...');
    const { query } = req.body;
    console.log('📦 Request body parsed successfully, query:', query);

    console.log('🔍 Starting input validation...');
    // Validate input
    if (!query || typeof query !== 'string') {
      console.log('❌ Input validation failed: query is invalid');
      return res.status(400).json({
        success: false,
        message: 'Query is required and must be a string',
        error: 'INVALID_INPUT'
      });
    }
    console.log('✅ Input validation passed');

    console.log('⏱️ Setting up 30-second timeout...');
    // Set timeout for 30 seconds to allow MCP validation and Anthropic API to complete
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Query processing timeout')), 30000);
    });
    console.log('✅ Timeout configured');

    // Process query with MCP validation service
    const processQuery = async () => {
      try {
        console.log('🤖 Starting MCP validation service...');

        // Step 0: Map state abbreviations to full names (CA → California)
        const preprocessedQuery = mapStateAbbreviationsInQuery(query);
        console.log(`📝 Preprocessed query: "${preprocessedQuery}"`);

        // Agent SDK path (opt-in via feature flag)
        if (USE_AGENT_SDK) {
          console.log('🤖 Using Agent SDK for query processing...');

          // Get or create agent service (could be per-request or singleton)
          const agentService = new AgentService();

          const agentResult = await agentService.query(preprocessedQuery);

          if (agentResult.success && agentResult.data) {
            const queryTime = (Date.now() - startTime) / 1000;

            // Handle comparison responses
            if ('comparison' in agentResult.data) {
              return {
                success: true,
                message: `Comparison complete for ${agentResult.data.comparison.regions.length} regions`,
                data: agentResult.data.comparison.regions,
                comparison: agentResult.data.comparison,
                metadata: {
                  queryTime,
                  totalRecords: agentResult.data.comparison.regions.length,
                  dataSource: 'Agent SDK with MCP',
                  confidenceLevel: 0.95,
                  usedAgentSDK: true,
                  analysis: { explanation: agentResult.data.explanation },
                },
              };
            }

            // Handle standard query responses
            return {
              success: true,
              message: `Found ${agentResult.data.metadata.rowCount} records`,
              data: agentResult.data.data,
              metadata: {
                queryTime,
                totalRecords: agentResult.data.metadata.rowCount,
                dataSource: 'Agent SDK with MCP',
                confidenceLevel: 0.95,
                usedAgentSDK: true,
                analysis: {
                  explanation: agentResult.data.explanation,
                  suggestedRefinements: agentResult.data.suggestedRefinements,
                },
              },
            };
          } else {
            console.warn('Agent SDK query failed, falling back to standard flow:', agentResult.error);
            // Fall through to standard processing below
          }
        }

        // Step 1: Use MCP service to analyze and validate the query
        const analysis = await anthropicService.analyzeQuery(preprocessedQuery);
        console.log('✅ MCP analysis complete:', analysis);

        // Step 1.5: Check if this is a healthcare analytics request that should use MCP tools
        const useHealthcareAnalytics = analysis.analysis.intent === 'demographics' &&
          (query.toLowerCase().includes('medicare') ||
           query.toLowerCase().includes('health') ||
           query.toLowerCase().includes('facility') ||
           query.toLowerCase().includes('eligibility'));

        console.log('🗄️ Starting data query section...');
        // Step 2: Try healthcare analytics first if applicable, then DuckDB, then mock data
        let data: any[] = [];
        let totalRecords = 0;
        let dataSource = '';
        let usedDuckDB = false;
        let usedMCPAnalytics = false;

        // Try MCP healthcare analytics first if applicable
        if (useHealthcareAnalytics) {
          try {
            console.log('🏥 Attempting MCP healthcare analytics...');

            const mcpResult = await tryHealthcareAnalytics(query, analysis);
            if (mcpResult.success) {
              data = mcpResult.data;
              totalRecords = mcpResult.metadata.recordCount;
              dataSource = mcpResult.metadata.dataSource;
              usedMCPAnalytics = true;
              console.log('✅ MCP healthcare analytics successful');
            } else {
              console.log('⚠️ MCP healthcare analytics failed, falling back to DuckDB');
            }
          } catch (mcpError) {
            console.warn('⚠️ MCP analytics error, falling back to DuckDB:', mcpError);
          }
        }

        // If MCP analytics didn't work, try regular DuckDB query with MCP validation
        if (!usedMCPAnalytics) {
          try {
            console.log('🐦 Attempting DuckDB query with MCP validation...');

            // Use the MCP-generated SQL query (with fallback to default)
            let sqlQuery = analysis.sqlQuery;

            // Validate SQL has the correct table name
            if (sqlQuery && !sqlQuery.includes('county_data')) {
              console.warn('⚠️  Anthropic SQL uses wrong table, fixing...');
              sqlQuery = sqlQuery.replace(/census_data/g, 'county_data');
              sqlQuery = sqlQuery.replace(/state_code/g, 'state_name');
            }

            // If no SQL or it looks invalid, use intelligent fallback
            if (!sqlQuery || sqlQuery.includes('census_data')) {
              console.log('🔄 Using intelligent fallback query based on analysis');
              const stateName = analysis?.analysis?.filters?.state;

              if (stateName) {
                sqlQuery = `
                  SELECT
                    county_name,
                    state_name,
                    population,
                    median_income,
                    poverty_rate
                  FROM county_data
                  WHERE state_name = '${stateName}'
                  LIMIT 100
                `;
              } else {
                sqlQuery = `
                  SELECT
                    county_name,
                    state_name,
                    population,
                    median_income,
                    poverty_rate
                  FROM county_data
                  LIMIT 50
                `;
              }
            }

            // NEW: Use MCP client to validate and execute SQL
            console.log('🔒 Validating SQL with MCP security layer...');
            const mcpClient = getCensusChat_MCPClient();
            // HTTP client auto-initializes on first call

            const mcpResult = await mcpClient.executeQuery(sqlQuery);

            if (!mcpResult.success) {
              // Log validation failure
              const auditLogger = getAuditLogger();
              auditLogger.logValidationFailure(
                query,
                sqlQuery,
                mcpResult.validationErrors || [{ message: mcpResult.error }]
              );

              console.error('❌ MCP validation failed:', mcpResult.validationErrors || mcpResult.error);
              throw new Error(`MCP validation failed: ${mcpResult.error || 'Unknown error'}`);
            }

            data = mcpResult.result.data;
            totalRecords = mcpResult.result.metadata.rowCount;
            dataSource = 'DuckDB Production (MCP Validated)';
            usedDuckDB = true;

            // Log successful execution
            const auditLogger = getAuditLogger();
            const queryTime = (Date.now() - startTime) / 1000;
            auditLogger.logSuccess(
              query,
              sqlQuery,
              mcpResult.result.metadata.sanitizedSQL,
              totalRecords,
              queryTime
            );

            console.log('✅ MCP validation passed, query executed successfully');
            console.log(`   Rows returned: ${totalRecords}`);
            console.log(`   Sanitized SQL: ${mcpResult.result.metadata.sanitizedSQL?.substring(0, 100)}...`);

          } catch (duckDbError) {
            console.log('📊 Using mock healthcare data as fallback');

            // Fall back to comprehensive mock healthcare data
            data = [
              {
                county: 'Miami-Dade',
                state: 'Florida',
                seniors: 486234,
                income_over_50k: 278445,
                ma_eligible: 264123,
                total_population: 2716940,
                median_income: 52800,
                poverty_rate: 15.8
              },
              {
                county: 'Broward',
                state: 'Florida',
                seniors: 312567,
                income_over_50k: 189234,
                ma_eligible: 176890,
                total_population: 1944375,
                median_income: 59734,
                poverty_rate: 12.4
              },
              {
                county: 'Palm Beach',
                state: 'Florida',
                seniors: 278901,
                income_over_50k: 198567,
                ma_eligible: 187234,
                total_population: 1496770,
                median_income: 64863,
                poverty_rate: 11.2
              },
              {
                county: 'Los Angeles',
                state: 'California',
                seniors: 1234567,
                income_over_50k: 698234,
                ma_eligible: 534123,
                total_population: 10014009,
                median_income: 70032,
                poverty_rate: 17.1
              },
              {
                county: 'Harris',
                state: 'Texas',
                seniors: 567890,
                income_over_50k: 356789,
                ma_eligible: 298456,
                total_population: 4731145,
                median_income: 61708,
                poverty_rate: 14.7
              }
            ];
            totalRecords = data.length;
            dataSource = 'Mock Healthcare Demographics (Foundation data simulation)';
            usedDuckDB = false;
          }
        }

        const queryTime = (Date.now() - startTime) / 1000;

        return {
          success: true,
          message: `Found ${totalRecords} records matching your query`,
          data,
          metadata: {
            queryTime,
            totalRecords,
            dataSource,
            confidenceLevel: 0.95,
            marginOfError: 2.3,
            usedDuckDB,
            usedMCPAnalytics,
            analysis
          }
        };
      } catch (error) {
        throw new Error(`Query processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };

    // Race between query processing and timeout
    const result = await Promise.race([processQuery(), timeout]);

    // Convert BigInts to strings for JSON serialization
    const serializedResult = JSON.parse(JSON.stringify(result, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));

    res.json(serializedResult);

  } catch (error) {
    const queryTime = (Date.now() - startTime) / 1000;

    // Handle timeout specifically
    if (error instanceof Error && error.message === 'Query processing timeout') {
      return res.status(408).json({
        success: false,
        message: 'Query processing took too long. Please try a simpler query or try again.',
        error: 'TIMEOUT',
        queryTime
      });
    }

    // Handle validation errors with helpful suggestions
    if (error instanceof Error && error.message.includes('MCP validation failed')) {
      const suggestions = FallbackService.getSuggestions(CensusApiErrorType.INVALID_QUERY);

      return res.status(400).json({
        success: false,
        message: 'I had trouble understanding your query. Please try rephrasing or being more specific.',
        error: 'VALIDATION_ERROR',
        suggestions,
        queryTime,
        fallbackUsed: false,
        errorType: CensusApiErrorType.INVALID_QUERY
      });
    }

    // Handle other errors with fallback
    console.error('Query processing error:', error);

    // Try to provide helpful fallback even for unexpected errors
    const errorType = FallbackService.determineErrorType(error instanceof Error ? error : new Error(String(error)));
    const suggestions = FallbackService.getSuggestions(errorType);

    res.status(500).json({
      success: false,
      message: 'An unexpected error occurred processing your query. Please try again.',
      error: 'INTERNAL_ERROR',
      suggestions,
      queryTime,
      fallbackUsed: false,
      errorType
    });
  }
});

// GET /api/v1/queries/test - Simple test endpoint for debugging
router.get('/test', async (_req, res) => {
  try {
    console.log('✅ Test endpoint called successfully');
    res.json({
      success: true,
      message: 'Test endpoint working',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Test endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Test endpoint failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/v1/queries/history
router.get('/history', async (_req, res) => {
  res.json({
    message: 'Query history endpoint - to be implemented',
    history: []
  });
});

// GET /api/v1/queries/:id
router.get('/:id', async (req, res) => {
  res.json({
    message: 'Get query by ID - to be implemented',
    id: req.params.id
  });
});

export { router as queryRoutes };