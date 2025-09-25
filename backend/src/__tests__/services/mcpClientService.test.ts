import { getMCPClientService, closeMCPClientService } from '../../services/mcpClientService';
import { getDuckDBPool } from '../../utils/duckdbPool';

// Mock DuckDB pool for testing
jest.mock('../../utils/duckdbPool');

const mockDuckDBPool = {
  query: jest.fn(),
  initialize: jest.fn(),
  close: jest.fn(),
  getStats: jest.fn(() => ({ totalConnections: 1 })),
  healthCheck: jest.fn(() => Promise.resolve(true))
};

(getDuckDBPool as jest.Mock).mockReturnValue(mockDuckDBPool);

// Mock MCP client configuration
jest.mock('../../config/mcpConfig', () => ({
  mcpClientConfigs: {
    census_api: {
      name: 'Census Bureau API',
      enabled: true,
      endpoint: 'https://api.census.gov/mcp',
      timeout: 2000,
      retries: 2,
      authentication: {
        type: 'apikey',
        credentials: { api_key: 'test_key' }
      }
    },
    medicare_api: {
      name: 'CMS Medicare Data',
      enabled: false,
      endpoint: 'https://api.medicare.gov/mcp',
      timeout: 2000,
      retries: 2,
      authentication: {
        type: 'oauth',
        credentials: { client_id: 'test_id', client_secret: 'test_secret' }
      }
    }
  }
}));

describe('MCPClientService', () => {
  let mcpClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mcpClient = getMCPClientService();
  });

  afterEach(async () => {
    await mcpClient.disconnect();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await closeMCPClientService();
  });

  describe('Service Initialization', () => {
    it('should initialize with enabled clients', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      await mcpClient.initialize();

      expect(logSpy).toHaveBeenCalledWith('🚀 Initializing MCP Client connections...');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Connected: 1/1'));

      logSpy.mockRestore();
    });

    it('should handle no enabled clients', async () => {
      // Mock configuration with no enabled clients
      jest.doMock('../../config/mcpConfig', () => ({
        mcpClientConfigs: {
          census_api: { enabled: false },
          medicare_api: { enabled: false }
        }
      }));

      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      await mcpClient.initialize();

      expect(logSpy).toHaveBeenCalledWith('ℹ️ No external MCP clients configured');

      logSpy.mockRestore();
    });

    it('should handle connection failures gracefully', async () => {
      mockDuckDBPool.query.mockRejectedValueOnce(new Error('Connection failed'));

      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      await mcpClient.initialize();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to connect to MCP client census_api:'),
        expect.any(Error)
      );

      errorSpy.mockRestore();
    });
  });

  describe('Tool Execution', () => {
    beforeEach(async () => {
      // Mock successful MCP tool calls
      mockDuckDBPool.query.mockImplementation((query: string) => {
        if (query.includes('mcp_call_tool')) {
          return Promise.resolve([
            {
              county: 'Miami-Dade',
              state: 'Florida',
              population_total: 2716940,
              population_65_plus: 486234,
              median_household_income: 52800
            }
          ]);
        }
        return Promise.resolve([]);
      });

      await mcpClient.initialize();
    });

    it('should execute tool calls successfully', async () => {
      const toolCall = {
        client: 'census_api',
        tool: 'get_demographics',
        parameters: {
          geography_type: 'county',
          geography_codes: ['Miami-Dade']
        }
      };

      const result = await mcpClient.callTool(toolCall);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('county', 'Miami-Dade');
      expect(mockDuckDBPool.query).toHaveBeenCalledWith(
        expect.stringContaining('mcp_call_tool')
      );
    });

    it('should handle tool call timeouts', async () => {
      jest.useFakeTimers();

      // Mock a hanging query
      const hangingPromise = new Promise(() => {});
      mockDuckDBPool.query.mockReturnValueOnce(hangingPromise);

      const toolCall = {
        client: 'census_api',
        tool: 'get_demographics',
        parameters: { geography_type: 'county' },
        timeout: 1000
      };

      const resultPromise = mcpClient.callTool(toolCall);

      // Fast-forward time to trigger timeout
      jest.advanceTimersByTime(1001);

      await expect(resultPromise).rejects.toThrow('MCP tool call timeout');

      jest.useRealTimers();
    });

    it('should reject calls to non-connected clients', async () => {
      const toolCall = {
        client: 'non_existent_client',
        tool: 'test_tool',
        parameters: {}
      };

      await expect(mcpClient.callTool(toolCall)).rejects.toThrow(
        'MCP client not connected: non_existent_client'
      );
    });

    it('should fall back to simulation when MCP functions unavailable', async () => {
      mockDuckDBPool.query.mockRejectedValueOnce(new Error('mcp_call_tool does not exist'));

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Mock fallback query for census data
      mockDuckDBPool.query.mockResolvedValueOnce([
        {
          county: 'Broward',
          state: 'Florida',
          population_total: 1944375,
          population_65_plus: 312567,
          median_household_income: 59734
        }
      ]);

      const toolCall = {
        client: 'census_api',
        tool: 'get_demographics',
        parameters: {
          geography_type: 'county',
          geography_codes: ['Broward']
        }
      };

      const result = await mcpClient.callTool(toolCall);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('MCP tool function not available, using fallback')
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('county', 'Broward');

      warnSpy.mockRestore();
    });
  });

  describe('Census API Simulation', () => {
    beforeEach(async () => {
      // Force fallback mode by making MCP functions fail
      mockDuckDBPool.query.mockImplementation((query: string) => {
        if (query.includes('mcp_call_tool')) {
          throw new Error('mcp_call_tool does not exist');
        }
        // Return mock demographics data for fallback queries
        return Promise.resolve([
          {
            county: 'Palm Beach',
            state: 'Florida',
            population_total: 1496770,
            population_65_plus: 278901,
            median_household_income: 64863
          }
        ]);
      });

      await mcpClient.initialize();
    });

    it('should simulate get_demographics for state geography', async () => {
      const toolCall = {
        client: 'census_api',
        tool: 'get_demographics',
        parameters: {
          geography_type: 'state',
          geography_codes: ['Florida']
        }
      };

      const result = await mcpClient.callTool(toolCall);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('state', 'Florida');
      expect(mockDuckDBPool.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE state IN ('Florida')")
      );
    });

    it('should simulate get_demographics for county geography', async () => {
      const toolCall = {
        client: 'census_api',
        tool: 'get_demographics',
        parameters: {
          geography_type: 'county',
          geography_codes: ['Palm Beach']
        }
      };

      const result = await mcpClient.callTool(toolCall);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('county', 'Palm Beach');
      expect(mockDuckDBPool.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE county IN ('Palm Beach')")
      );
    });

    it('should handle unknown Census API tools', async () => {
      const toolCall = {
        client: 'census_api',
        tool: 'unknown_tool',
        parameters: {}
      };

      await expect(mcpClient.callTool(toolCall)).rejects.toThrow(
        'Unknown Census API tool: unknown_tool'
      );
    });
  });

  describe('Medicare API Simulation', () => {
    beforeEach(async () => {
      // Force fallback mode and ensure Medicare client appears connected
      mockDuckDBPool.query.mockImplementation((query: string) => {
        if (query.includes('ATTACH')) {
          throw new Error('ATTACH not available');
        }
        if (query.includes('mcp_call_tool')) {
          throw new Error('mcp_call_tool does not exist');
        }
        // Return mock Medicare data for fallback queries
        return Promise.resolve([
          {
            county: 'Miami-Dade',
            state: 'Florida',
            population_65_plus: 486234,
            ma_enrollment_estimate: 170182,
            ma_penetration_rate: 35.0
          }
        ]);
      });

      // Add medicare client as enabled for this test
      mcpClient.connectedClients = new Set(['medicare_api']);
    });

    it('should simulate get_ma_penetration tool', async () => {
      const toolCall = {
        client: 'medicare_api',
        tool: 'get_ma_penetration',
        parameters: {
          geography: 'county',
          year: 2024
        }
      };

      const result = await mcpClient.callTool(toolCall);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('ma_penetration_rate', 35.0);
      expect(mockDuckDBPool.query).toHaveBeenCalledWith(
        expect.stringContaining('population_65_plus * 0.35')
      );
    });

    it('should handle unknown Medicare API tools', async () => {
      const toolCall = {
        client: 'medicare_api',
        tool: 'unknown_tool',
        parameters: {}
      };

      await expect(mcpClient.callTool(toolCall)).rejects.toThrow(
        'Unknown Medicare API tool: unknown_tool'
      );
    });
  });

  describe('Tools Listing', () => {
    beforeEach(async () => {
      await mcpClient.initialize();
    });

    it('should list available tools for connected clients', async () => {
      mockDuckDBPool.query.mockRejectedValueOnce(new Error('mcp_list_tools not available'));

      const tools = await mcpClient.listAvailableTools();

      expect(tools).toHaveProperty('census_api');
      expect(tools.census_api).toContain('get_demographics');
      expect(tools.census_api).toContain('get_geography');
      expect(tools.census_api).toContain('get_acs_data');
    });

    it('should list tools for specific client', async () => {
      mockDuckDBPool.query.mockRejectedValueOnce(new Error('mcp_list_tools not available'));

      const tools = await mcpClient.listAvailableTools('census_api');

      expect(tools).toHaveProperty('census_api');
      expect(tools.census_api).toContain('get_demographics');
    });

    it('should handle unknown clients', async () => {
      const tools = await mcpClient.listAvailableTools('unknown_client');

      expect(tools).toEqual({});
    });
  });

  describe('Health Check', () => {
    it('should return true when no clients configured', async () => {
      const healthy = await mcpClient.healthCheck();
      expect(healthy).toBe(true);
    });

    it('should return true when clients are healthy', async () => {
      await mcpClient.initialize();

      mockDuckDBPool.query.mockResolvedValueOnce([
        { tools: ['get_demographics'] }
      ]);

      const healthy = await mcpClient.healthCheck();
      expect(healthy).toBe(true);
    });

    it('should return false when health check fails', async () => {
      await mcpClient.initialize();

      mockDuckDBPool.query.mockRejectedValueOnce(new Error('Health check failed'));

      const healthy = await mcpClient.healthCheck();
      expect(healthy).toBe(false);
    });
  });

  describe('Status Reporting', () => {
    it('should report connection status', async () => {
      await mcpClient.initialize();

      const status = mcpClient.getStatus();

      expect(status.connectedClients).toContain('census_api');
      expect(status.lastConnectAttempt).toBeDefined();
      expect(status.connectionErrors).toBeDefined();
    });
  });

  describe('Disconnection', () => {
    beforeEach(async () => {
      await mcpClient.initialize();
    });

    it('should disconnect specific client', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      await mcpClient.disconnect('census_api');

      expect(logSpy).toHaveBeenCalledWith('🔌 Disconnecting MCP client: census_api');
      expect(logSpy).toHaveBeenCalledWith('✅ Disconnected MCP client: census_api');

      logSpy.mockRestore();
    });

    it('should disconnect all clients when no specific client provided', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      await mcpClient.disconnect();

      expect(logSpy).toHaveBeenCalledWith('🔌 Disconnecting MCP client: census_api');

      logSpy.mockRestore();
    });

    it('should handle disconnection errors gracefully', async () => {
      mockDuckDBPool.query.mockRejectedValueOnce(new Error('Disconnection failed'));

      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      await mcpClient.disconnect('census_api');

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error disconnecting MCP client census_api:'),
        expect.any(Error)
      );

      errorSpy.mockRestore();
    });
  });
});