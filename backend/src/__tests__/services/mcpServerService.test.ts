import { getMCPServerService, closeMCPServerService } from '../../services/mcpServerService';
import { getDuckDBPool, closeDuckDBPool } from '../../utils/duckdbPool';

// Mock DuckDB pool for testing
jest.mock('../../utils/duckdbPool');

const mockDuckDBPool = {
  query: jest.fn(),
  initialize: jest.fn(),
  close: jest.fn(),
  getStats: jest.fn(() => ({ totalConnections: 1 })),
  healthCheck: jest.fn(() => Promise.resolve(true)),
  validateMCPExtension: jest.fn(() => Promise.resolve(true))
};

(getDuckDBPool as jest.Mock).mockReturnValue(mockDuckDBPool);

describe('MCPServerService', () => {
  let mcpServer: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mcpServer = getMCPServerService();
  });

  afterEach(async () => {
    if (mcpServer.getStatus().isRunning) {
      await mcpServer.stop();
    }
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await closeMCPServerService();
    await closeDuckDBPool();
  });

  describe('Service Lifecycle', () => {
    it('should initialize MCP server successfully', async () => {
      const startSpy = jest.spyOn(console, 'log').mockImplementation();

      await mcpServer.start();

      expect(mcpServer.getStatus().isRunning).toBe(true);
      expect(mcpServer.getStatus().startTime).toBeDefined();
      expect(startSpy).toHaveBeenCalledWith('✅ MCP Server started successfully');

      startSpy.mockRestore();
    });

    it('should handle MCP server already running', async () => {
      const warnSpy = jest.spyOn(console, 'log').mockImplementation();

      await mcpServer.start();
      await mcpServer.start(); // Second start should warn

      expect(warnSpy).toHaveBeenCalledWith('⚠️ MCP Server already running');
      warnSpy.mockRestore();
    });

    it('should stop MCP server gracefully', async () => {
      await mcpServer.start();

      const stopSpy = jest.spyOn(console, 'log').mockImplementation();
      await mcpServer.stop();

      expect(mcpServer.getStatus().isRunning).toBe(false);
      expect(stopSpy).toHaveBeenCalledWith('✅ MCP Server stopped');

      stopSpy.mockRestore();
    });

    it('should handle stopping non-running server', async () => {
      const warnSpy = jest.spyOn(console, 'log').mockImplementation();

      await mcpServer.stop();

      expect(warnSpy).toHaveBeenCalledWith('⚠️ MCP Server not running');
      warnSpy.mockRestore();
    });
  });

  describe('Healthcare Tools Execution', () => {
    beforeEach(async () => {
      // Mock successful healthcare data queries
      mockDuckDBPool.query.mockImplementation((query: string) => {
        if (query.includes('medicare_eligibility')) {
          return Promise.resolve([
            {
              county: 'Miami-Dade',
              state: 'Florida',
              population_total: 2716940,
              population_65_plus: 486234,
              medicare_eligible_rate: 17.89,
              senior_population_category: 'Moderate Senior Population'
            }
          ]);
        }
        if (query.includes('population_health')) {
          return Promise.resolve([
            {
              county: 'Miami-Dade',
              state: 'Florida',
              population_total: 2716940,
              median_household_income: 52800,
              income_risk_score: 2,
              risk_category: 'Moderate Risk'
            }
          ]);
        }
        if (query.includes('facility_adequacy')) {
          return Promise.resolve([
            {
              county: 'Miami-Dade',
              state: 'Florida',
              population_total: 2716940,
              population_65_plus: 486234,
              facilities_per_10k_estimate: 271.69,
              adequacy_rating: 'Adequately Served'
            }
          ]);
        }
        return Promise.resolve([]);
      });

      await mcpServer.start();
    });

    it('should execute Medicare eligibility analysis', async () => {
      const parameters = {
        geography_type: 'county',
        geography_codes: ['Miami-Dade'],
        year: 2024
      };

      const result = await mcpServer.executeTool('calculate_medicare_eligibility', parameters);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('county', 'Miami-Dade');
      expect(result[0]).toHaveProperty('medicare_eligible_rate', 17.89);
      expect(mockDuckDBPool.query).toHaveBeenCalledWith(
        expect.stringContaining('medicare_eligibility')
      );
    });

    it('should execute population health risk assessment', async () => {
      const parameters = {
        geography_type: 'county',
        geography_codes: ['Miami-Dade'],
        risk_factors: ['income', 'age']
      };

      const result = await mcpServer.executeTool('population_health_risk', parameters);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('county', 'Miami-Dade');
      expect(result[0]).toHaveProperty('risk_category', 'Moderate Risk');
      expect(mockDuckDBPool.query).toHaveBeenCalledWith(
        expect.stringContaining('population_health')
      );
    });

    it('should execute facility adequacy analysis', async () => {
      const parameters = {
        geography_type: 'county',
        geography_codes: ['Miami-Dade'],
        facility_type: 'hospital'
      };

      const result = await mcpServer.executeTool('facility_adequacy', parameters);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('county', 'Miami-Dade');
      expect(result[0]).toHaveProperty('adequacy_rating', 'Adequately Served');
      expect(mockDuckDBPool.query).toHaveBeenCalledWith(
        expect.stringContaining('facility_adequacy')
      );
    });

    it('should handle unknown tool execution', async () => {
      await expect(
        mcpServer.executeTool('unknown_tool', {})
      ).rejects.toThrow('Tool not registered: unknown_tool');
    });

    it('should handle database errors during tool execution', async () => {
      mockDuckDBPool.query.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(
        mcpServer.executeTool('calculate_medicare_eligibility', {
          geography_type: 'county',
          geography_codes: ['Miami-Dade']
        })
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('Health Check', () => {
    it('should return false when server is not running', async () => {
      const healthy = await mcpServer.healthCheck();
      expect(healthy).toBe(false);
    });

    it('should return true when server is running and database is accessible', async () => {
      await mcpServer.start();

      // Mock the health check query after server is started
      mockDuckDBPool.query.mockResolvedValueOnce([{ count: 1 }]);

      const healthy = await mcpServer.healthCheck();
      expect(healthy).toBe(true);
    });

    it('should return false when database is not accessible', async () => {
      await mcpServer.start();

      // Mock health check query to fail after server is started
      mockDuckDBPool.query.mockRejectedValueOnce(new Error('Database error'));

      const healthy = await mcpServer.healthCheck();
      expect(healthy).toBe(false);
    });
  });

  describe('Status Reporting', () => {
    it('should report correct status when stopped', () => {
      const status = mcpServer.getStatus();

      expect(status.isRunning).toBe(false);
      expect(status.startTime).toBeUndefined();
      expect(status.resourcesPublished).toBe(0);
      expect(status.toolsRegistered).toBe(0);
    });

    it('should report correct status when running', async () => {
      await mcpServer.start();
      const status = mcpServer.getStatus();

      expect(status.isRunning).toBe(true);
      expect(status.startTime).toBeDefined();
      expect(status.resourcesPublished).toBeGreaterThan(0);
      expect(status.toolsRegistered).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle MCP extension not available', async () => {
      mockDuckDBPool.validateMCPExtension.mockResolvedValueOnce(false);

      await expect(mcpServer.start()).rejects.toThrow('MCP extension not available in DuckDB');
    });

    it('should handle MCP server function not available', async () => {
      mockDuckDBPool.query.mockRejectedValueOnce(new Error('mcp_server_start does not exist'));

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await mcpServer.start();

      expect(warnSpy).toHaveBeenCalledWith('⚠️ MCP server function not available, running in compatibility mode');
      expect(mcpServer.getStatus().isRunning).toBe(true);

      warnSpy.mockRestore();
    });

    it('should emit error event on startup failure', async () => {
      // Mock initialization to fail
      mockDuckDBPool.initialize.mockRejectedValueOnce(new Error('Initialization failed'));

      // Reset the mock to ensure the initialization call fails
      jest.clearAllMocks();
      mockDuckDBPool.initialize.mockRejectedValueOnce(new Error('Initialization failed'));
      mockDuckDBPool.getStats.mockReturnValue({ totalConnections: 0 });

      const errorSpy = jest.fn();
      mcpServer.on('error', errorSpy);

      await expect(mcpServer.start()).rejects.toThrow('Initialization failed');
      expect(errorSpy).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});