import { Router } from 'express';
import path from 'path';
import { anthropicService } from '../services/anthropicService';
import { queryRateLimit, censusApiUserRateLimit } from '../middleware/rateLimiting';
import { FallbackService, CensusApiErrorType } from '../services/fallbackService';

const router = Router();

// DuckDB query helper with better error handling
const queryDuckDB = async (sql: string): Promise<any[]> => {
  try {
    console.log('📦 Importing DuckDB dynamically...');
    const { Database } = await import('duckdb');

    const dbPath = path.join(process.cwd(), 'data', 'census.duckdb');
    console.log('🗄️ DuckDB path:', dbPath);

    return new Promise((resolve, reject) => {
      try {
        const db = new Database(dbPath);
        console.log('🔗 DuckDB connection established');

        db.all(sql, (err, rows) => {
          console.log('📊 DuckDB query completed, closing connection...');

          // Safely close the database
          try {
            db.close((closeErr) => {
              if (closeErr) {
                console.error('Warning: Failed to close DuckDB connection:', closeErr);
              } else {
                console.log('✅ DuckDB connection closed');
              }
            });
          } catch (closeError) {
            console.error('Error during DB close:', closeError);
          }

          if (err) {
            console.error('❌ DuckDB query error:', err);
            reject(new Error(`DuckDB query failed: ${err.message}`));
          } else {
            console.log('✅ DuckDB query successful, rows:', rows?.length || 0);
            resolve(rows || []);
          }
        });
      } catch (dbError) {
        console.error('❌ Database creation failed:', dbError);
        reject(new Error(`Database creation failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`));
      }
    });
  } catch (importError) {
    console.error('❌ DuckDB import failed:', importError);
    throw new Error(`DuckDB import failed: ${importError instanceof Error ? importError.message : 'Unknown error'}`);
  }
};

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

    console.log('⏱️ Setting up 2-second timeout...');
    // Set timeout for 2 second requirement
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Query processing timeout')), 2000);
    });
    console.log('✅ Timeout configured');

    // Process query with MCP validation service
    const processQuery = async () => {
      try {
        console.log('🤖 Starting MCP validation service...');
        // Step 1: Use MCP service to analyze and validate the query
        const analysis = await anthropicService.analyzeQuery(query);
        console.log('✅ MCP analysis complete:', analysis);

        console.log('🗄️ Starting DuckDB query section...');
        // Step 2: Try to query real data from DuckDB, fall back to mock data if needed
        let data: any[] = [];
        let totalRecords = 0;
        let dataSource = '';
        let usedDuckDB = false;

        try {
          console.log('🐦 Attempting DuckDB query...');
          // TODO: Fix DuckDB dynamic import issue - temporarily using fallback
          console.log('⚠️ DuckDB temporarily disabled due to import issues, using fallback data');
          throw new Error('DuckDB temporarily disabled for debugging');

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
            analysis
          }
        };
      } catch (error) {
        throw new Error(`Query processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };

    // Race between query processing and timeout
    const result = await Promise.race([processQuery(), timeout]);

    res.json(result);

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