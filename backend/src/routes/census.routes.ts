import { Router, Request, Response } from 'express';
import { censusApiService } from '../services/censusApiService';
import { censusDataModel } from '../models/CensusData';
import { censusDataLoader } from '../utils/censusDataLoader';
import { getCacheStats, invalidateCache, cleanExpiredCache } from '../services/cacheService';

const router = Router();

/**
 * @route GET /api/v1/census/test-connection
 * @desc Test Census API connectivity and authentication
 * @access Public
 */
router.get('/test-connection', async (req: Request, res: Response) => {
  try {
    const serviceStatus = censusApiService.getServiceStatus();
    const authResult = await censusApiService.testAuthentication();

    let datasets = {};
    try {
      datasets = await censusApiService.getAvailableDatasets();
    } catch (error) {
      console.warn('Could not load datasets:', error instanceof Error ? error.message : 'Unknown error');
    }

    res.json({
      success: authResult.authenticated || !serviceStatus.configuration.useLiveApi,
      message: authResult.message,
      serviceStatus,
      authentication: authResult,
      availableDatasets: Object.keys(datasets),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Census API test connection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test Census API connection',
      message: error instanceof Error ? error.message : 'Unknown error',
      serviceStatus: censusApiService.getServiceStatus()
    });
  }
});

/**
 * @route GET /api/v1/census/test-queries
 * @desc Get available test queries from knowledge base
 * @access Public
 */
router.get('/test-queries', async (req: Request, res: Response) => {
  try {
    const testQueries = await censusApiService.getTestQueries();
    const geographicLevels = await censusApiService.getGeographicLevels();
    
    res.json({
      success: true,
      testQueries,
      geographicLevels,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching test queries:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch test queries',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route POST /api/v1/census/execute-test/:testName
 * @desc Execute a predefined test query
 * @access Public
 */
router.post('/execute-test/:testName', async (req: Request, res: Response) => {
  try {
    const { testName } = req.params;
    
    if (!['zip5_acs5', 'blockgroup_acs5'].includes(testName)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid test name',
        validTests: ['zip5_acs5', 'blockgroup_acs5']
      });
    }

    const response = await censusApiService.executeTestQuery(testName as 'zip5_acs5' | 'blockgroup_acs5');
    
    res.json({
      success: true,
      testName,
      data: response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error executing test query ${req.params.testName}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute test query',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/v1/census/acs5/zip
 * @desc Get ACS 5-Year data for ZIP Code Tabulation Areas
 * @access Public
 */
router.get('/acs5/zip', async (req: Request, res: Response) => {
  try {
    const { state = '06', variables } = req.query;
    const variableList = variables ? (variables as string).split(',') : undefined;
    
    const response = await censusApiService.getACS5ZipData(state as string, variableList);
    
    res.json({
      success: true,
      geography: 'ZIP Code Tabulation Area',
      state,
      data: response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching ACS5 ZIP data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ACS5 ZIP data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/v1/census/acs5/block-group
 * @desc Get ACS 5-Year data for Census Block Groups
 * @access Public
 */
router.get('/acs5/block-group', async (req: Request, res: Response) => {
  try {
    const { state = '06', county = '075', variables } = req.query;
    const variableList = variables ? (variables as string).split(',') : undefined;
    
    const response = await censusApiService.getACS5BlockGroupData(
      state as string, 
      county as string, 
      variableList
    );
    
    res.json({
      success: true,
      geography: 'Census Block Group',
      state,
      county,
      data: response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching ACS5 Block Group data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ACS5 Block Group data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route POST /api/v1/census/load-test-data
 * @desc Load initial test data into DuckDB
 * @access Public
 */
router.post('/load-test-data', async (req: Request, res: Response) => {
  try {
    console.log('Starting Census test data loading...');
    const result = await censusDataLoader.loadAllTestData();
    
    res.json({
      success: result.summary.allSuccessful,
      message: result.summary.allSuccessful ? 'Test data loaded successfully' : 'Test data loaded with errors',
      results: {
        variables: result.variables,
        zip5: result.zip5,
        blockGroup: result.blockGroup,
        summary: result.summary
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error loading test data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load test data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/v1/census/data/stats
 * @desc Get statistics about stored Census data
 * @access Public
 */
router.get('/data/stats', async (req: Request, res: Response) => {
  try {
    const geographyStats = await censusDataModel.getGeographyLevelStats();
    
    // Get sample data for each geography level
    const sampleData = await censusDataModel.queryCensusData({
      variables: ['B01003_001E'],
      limit: 10
    });

    res.json({
      success: true,
      geographyLevels: geographyStats,
      sampleData: sampleData.map(record => ({
        geography: record.geography_name,
        level: record.geography_level,
        population: record.variable_value,
        state: record.state_code
      })),
      totalRecords: geographyStats.reduce((sum, stat) => sum + stat.count, 0),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching data stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch data statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/v1/census/data/query
 * @desc Query stored Census data with filters
 * @access Public
 */
router.get('/data/query', async (req: Request, res: Response) => {
  try {
    const {
      geographyLevel,
      stateCodes,
      variables,
      dataset,
      year,
      limit = '100'
    } = req.query;

    const filters: any = {};
    
    if (geographyLevel) {
      filters.geographyLevel = (geographyLevel as string).split(',');
    }
    
    if (stateCodes) {
      filters.stateCodes = (stateCodes as string).split(',');
    }
    
    if (variables) {
      filters.variables = (variables as string).split(',');
    }
    
    if (dataset) {
      filters.dataset = dataset as string;
    }
    
    if (year) {
      filters.year = year as string;
    }
    
    filters.limit = parseInt(limit as string, 10);

    const results = await censusDataModel.queryCensusData(filters);
    
    res.json({
      success: true,
      filters,
      results,
      count: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error querying Census data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to query Census data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route POST /api/v1/census/validate-variables
 * @desc Validate Census variable names
 * @access Public
 */
router.post('/validate-variables', async (req: Request, res: Response) => {
  try {
    const { variables } = req.body;
    
    if (!Array.isArray(variables)) {
      return res.status(400).json({
        success: false,
        error: 'Variables must be provided as an array'
      });
    }

    const validation = await censusApiService.validateVariables(variables);
    
    res.json({
      success: true,
      validation,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error validating variables:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate variables',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/v1/census/counties/:state
 * @desc Get counties in a state for block group queries
 * @access Public
 */
router.get('/counties/:state', async (req: Request, res: Response) => {
  try {
    const { state } = req.params;
    
    const response = await censusApiService.getCountiesInState(state);
    
    res.json({
      success: true,
      state,
      counties: response.data.slice(1).map(row => ({
        name: row[0],
        code: row[1],
        state: row[2]
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error fetching counties for state ${req.params.state}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch counties',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/v1/census/cache/stats
 * @desc Get cache statistics
 * @access Public
 */
router.get('/cache/stats', async (req: Request, res: Response) => {
  try {
    const stats = await getCacheStats();

    res.json({
      success: true,
      cacheStats: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route POST /api/v1/census/cache/invalidate
 * @desc Invalidate cache entries
 * @access Public
 */
router.post('/cache/invalidate', async (req: Request, res: Response) => {
  try {
    const { pattern } = req.body;

    const deletedCount = await invalidateCache(pattern);

    res.json({
      success: true,
      message: `Invalidated ${deletedCount} cache entries`,
      deletedCount,
      pattern: pattern || 'all',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error invalidating cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to invalidate cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route POST /api/v1/census/cache/clean
 * @desc Clean expired cache entries
 * @access Public
 */
router.post('/cache/clean', async (req: Request, res: Response) => {
  try {
    const cleanedCount = await cleanExpiredCache();

    res.json({
      success: true,
      message: `Cleaned ${cleanedCount} expired cache entries`,
      cleanedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error cleaning cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clean cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;