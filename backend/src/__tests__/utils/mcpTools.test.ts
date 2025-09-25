import {
  HealthcareAnalyticsTools,
  executeMedicareAnalysis,
  executePopulationHealthAnalysis,
  executeFacilityAnalysis
} from '../../utils/mcpTools';
import { getMCPServerService } from '../../services/mcpServerService';
import { getMCPClientService } from '../../services/mcpClientService';

// Mock MCP services
jest.mock('../../services/mcpServerService');
jest.mock('../../services/mcpClientService');

const mockMCPServer = {
  executeTool: jest.fn()
};

const mockMCPClient = {
  callTool: jest.fn()
};

(getMCPServerService as jest.Mock).mockReturnValue(mockMCPServer);
(getMCPClientService as jest.Mock).mockReturnValue(mockMCPClient);

describe('HealthcareAnalyticsTools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('executeAnalysis', () => {
    it('should execute Medicare eligibility analysis', async () => {
      const mockData = [
        {
          county: 'Miami-Dade',
          state: 'Florida',
          population_total: 2716940,
          population_65_plus: 486234,
          medicare_eligible_rate: 17.89
        }
      ];

      mockMCPServer.executeTool.mockResolvedValueOnce(mockData);

      const request = {
        analysisType: 'medicare_eligibility' as const,
        parameters: {
          geography_type: 'county',
          geography_codes: ['Miami-Dade']
        },
        useExternalData: false
      };

      const result = await HealthcareAnalyticsTools.executeAnalysis(request);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(result.metadata.analysisType).toBe('medicare_eligibility');
      expect(result.metadata.dataSource).toBe('CensusChat Internal');
      expect(result.metadata.recordCount).toBe(1);
      expect(result.metadata.executionTime).toBeGreaterThan(0);

      expect(mockMCPServer.executeTool).toHaveBeenCalledWith(
        'calculate_medicare_eligibility',
        request.parameters
      );
    });

    it('should execute population health analysis', async () => {
      const mockData = [
        {
          county: 'Broward',
          state: 'Florida',
          population_total: 1944375,
          median_household_income: 59734,
          income_risk_score: 2,
          risk_category: 'Moderate Risk'
        }
      ];

      mockMCPServer.executeTool.mockResolvedValueOnce(mockData);

      const request = {
        analysisType: 'population_health' as const,
        parameters: {
          geography_type: 'county',
          geography_codes: ['Broward'],
          risk_factors: ['income', 'age']
        }
      };

      const result = await HealthcareAnalyticsTools.executeAnalysis(request);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(result.metadata.analysisType).toBe('population_health');

      expect(mockMCPServer.executeTool).toHaveBeenCalledWith(
        'population_health_risk',
        request.parameters
      );
    });

    it('should execute facility adequacy analysis', async () => {
      const mockData = [
        {
          county: 'Palm Beach',
          state: 'Florida',
          population_total: 1496770,
          facilities_per_10k_estimate: 149.68,
          adequacy_rating: 'Adequately Served'
        }
      ];

      mockMCPServer.executeTool.mockResolvedValueOnce(mockData);

      const request = {
        analysisType: 'facility_adequacy' as const,
        parameters: {
          geography_type: 'county',
          geography_codes: ['Palm Beach'],
          facility_type: 'hospital'
        }
      };

      const result = await HealthcareAnalyticsTools.executeAnalysis(request);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(result.metadata.analysisType).toBe('facility_adequacy');

      expect(mockMCPServer.executeTool).toHaveBeenCalledWith(
        'facility_adequacy',
        request.parameters
      );
    });

    it('should handle unknown analysis type', async () => {
      const request = {
        analysisType: 'unknown_analysis' as any,
        parameters: {}
      };

      mockMCPServer.executeTool.mockRejectedValueOnce(new Error('Unknown analysis type: unknown_analysis'));

      const result = await HealthcareAnalyticsTools.executeAnalysis(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown analysis type: unknown_analysis');
      expect(result.data).toEqual([]);
    });

    it('should handle MCP server errors gracefully', async () => {
      mockMCPServer.executeTool.mockRejectedValueOnce(new Error('Server connection failed'));

      const request = {
        analysisType: 'medicare_eligibility' as const,
        parameters: {
          geography_type: 'county',
          geography_codes: ['Miami-Dade']
        }
      };

      const result = await HealthcareAnalyticsTools.executeAnalysis(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Server connection failed');
      expect(result.data).toEqual([]);
      expect(result.metadata.dataSource).toBe('Error');
    });
  });

  describe('External Data Enrichment', () => {
    it('should enrich Medicare data with external sources', async () => {
      const internalData = [
        {
          county: 'Miami-Dade',
          state: 'Florida',
          population_65_plus: 486234
        }
      ];

      const externalData = [
        {
          county: 'Miami-Dade',
          state: 'Florida',
          ma_enrollment_estimate: 170182,
          ma_penetration_rate: 35.0
        }
      ];

      mockMCPServer.executeTool.mockResolvedValueOnce(internalData);
      mockMCPClient.callTool.mockResolvedValueOnce(externalData);

      const request = {
        analysisType: 'medicare_eligibility' as const,
        parameters: {
          geography_type: 'county',
          geography_codes: ['Miami-Dade']
        },
        useExternalData: true
      };

      const result = await HealthcareAnalyticsTools.executeAnalysis(request);

      expect(result.success).toBe(true);
      expect(result.metadata.dataSource).toBe('CensusChat + External MCP');
      expect(result.data[0]).toHaveProperty('ma_enrollment_estimate', 170182);
      expect(result.data[0]).toHaveProperty('data_sources');
      expect(result.data[0].data_sources).toContain('CensusChat');
      expect(result.data[0].data_sources).toContain('Medicare API');
    });

    it('should enrich population health data with Census API', async () => {
      const internalData = [
        {
          county: 'Broward',
          state: 'Florida',
          population_total: 1944375,
          median_household_income: 59734
        }
      ];

      const censusData = [
        {
          county: 'Broward',
          state: 'Florida',
          population_total: 1950000,
          median_household_income: 60000
        }
      ];

      mockMCPServer.executeTool.mockResolvedValueOnce(internalData);
      mockMCPClient.callTool.mockResolvedValueOnce(censusData);

      const request = {
        analysisType: 'population_health' as const,
        parameters: {
          geography_type: 'county',
          geography_codes: ['Broward'],
          risk_factors: ['income']
        },
        useExternalData: true
      };

      const result = await HealthcareAnalyticsTools.executeAnalysis(request);

      expect(result.success).toBe(true);
      expect(result.metadata.dataSource).toBe('CensusChat + External MCP');
      expect(result.data[0]).toHaveProperty('external_population_total', 1950000);
      expect(result.data[0]).toHaveProperty('external_median_income', 60000);
      expect(result.data[0].data_sources).toContain('Census API');
    });

    it('should handle external data enrichment failures gracefully', async () => {
      const internalData = [
        {
          county: 'Palm Beach',
          state: 'Florida',
          population_total: 1496770
        }
      ];

      mockMCPServer.executeTool.mockResolvedValueOnce(internalData);
      mockMCPClient.callTool.mockRejectedValueOnce(new Error('External API failed'));

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const request = {
        analysisType: 'medicare_eligibility' as const,
        parameters: {
          geography_type: 'county',
          geography_codes: ['Palm Beach']
        },
        useExternalData: true
      };

      const result = await HealthcareAnalyticsTools.executeAnalysis(request);

      expect(result.success).toBe(true);
      expect(result.metadata.dataSource).toBe('CensusChat Internal');
      expect(result.data).toEqual(internalData);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('External data enrichment failed'),
        expect.any(Error)
      );

      warnSpy.mockRestore();
    });
  });

  describe('Parameter Validation', () => {
    it('should validate Medicare eligibility parameters', () => {
      const validParams = {
        geography_type: 'county',
        geography_codes: ['Miami-Dade'],
        year: 2024
      };

      const result = HealthcareAnalyticsTools.validateAnalysisParameters('medicare_eligibility', validParams);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid geography type', () => {
      const invalidParams = {
        geography_type: 'invalid',
        geography_codes: ['Miami-Dade']
      };

      const result = HealthcareAnalyticsTools.validateAnalysisParameters('medicare_eligibility', invalidParams);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Valid geography_type required (state, county, or zipcode)');
    });

    it('should reject missing geography codes', () => {
      const invalidParams = {
        geography_type: 'county',
        geography_codes: []
      };

      const result = HealthcareAnalyticsTools.validateAnalysisParameters('medicare_eligibility', invalidParams);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('geography_codes array with at least one value required');
    });

    it('should validate year bounds for Medicare analysis', () => {
      const invalidParams = {
        geography_type: 'county',
        geography_codes: ['Miami-Dade'],
        year: 2019
      };

      const result = HealthcareAnalyticsTools.validateAnalysisParameters('medicare_eligibility', invalidParams);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Year must be between 2020 and current year');
    });

    it('should validate risk factors for population health analysis', () => {
      const validParams = {
        geography_type: 'county',
        geography_codes: ['Broward'],
        risk_factors: ['income', 'age']
      };

      const result = HealthcareAnalyticsTools.validateAnalysisParameters('population_health', validParams);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid risk factors', () => {
      const invalidParams = {
        geography_type: 'county',
        geography_codes: ['Broward'],
        risk_factors: ['invalid_factor']
      };

      const result = HealthcareAnalyticsTools.validateAnalysisParameters('population_health', invalidParams);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid risk factors: invalid_factor');
    });

    it('should validate facility type for facility analysis', () => {
      const validParams = {
        geography_type: 'county',
        geography_codes: ['Palm Beach'],
        facility_type: 'hospital'
      };

      const result = HealthcareAnalyticsTools.validateAnalysisParameters('facility_adequacy', validParams);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid facility type', () => {
      const invalidParams = {
        geography_type: 'county',
        geography_codes: ['Palm Beach'],
        facility_type: 'invalid_facility'
      };

      const result = HealthcareAnalyticsTools.validateAnalysisParameters('facility_adequacy', invalidParams);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('facility_type must be hospital, clinic, pharmacy, or all');
    });
  });

  describe('Healthcare Prompt Templates', () => {
    it('should return valid prompt templates', () => {
      const templates = HealthcareAnalyticsTools.getHealthcarePromptTemplates();

      expect(templates).toHaveProperty('medicare_eligibility_analysis');
      expect(templates).toHaveProperty('population_health_assessment');
      expect(templates).toHaveProperty('facility_adequacy_analysis');

      expect(templates.medicare_eligibility_analysis).toHaveProperty('name');
      expect(templates.medicare_eligibility_analysis).toHaveProperty('description');
      expect(templates.medicare_eligibility_analysis).toHaveProperty('template');
      expect(templates.medicare_eligibility_analysis).toHaveProperty('parameters');
    });
  });

  describe('Available Analyses', () => {
    it('should return list of available analyses', () => {
      const analyses = HealthcareAnalyticsTools.getAvailableAnalyses();

      expect(analyses).toHaveProperty('medicare_eligibility');
      expect(analyses).toHaveProperty('population_health');
      expect(analyses).toHaveProperty('facility_adequacy');

      expect(analyses.medicare_eligibility).toContain('Medicare eligibility');
      expect(analyses.population_health).toContain('population health');
      expect(analyses.facility_adequacy).toContain('facility adequacy');
    });
  });

  describe('Convenience Functions', () => {
    beforeEach(() => {
      mockMCPServer.executeTool.mockResolvedValue([{ test: 'data' }]);
    });

    it('should execute Medicare analysis via convenience function', async () => {
      const parameters = {
        geography_type: 'county',
        geography_codes: ['Miami-Dade']
      };

      const result = await executeMedicareAnalysis(parameters);

      expect(result.success).toBe(true);
      expect(result.metadata.analysisType).toBe('medicare_eligibility');
      expect(mockMCPServer.executeTool).toHaveBeenCalledWith('calculate_medicare_eligibility', parameters);
    });

    it('should execute population health analysis via convenience function', async () => {
      const parameters = {
        geography_type: 'county',
        geography_codes: ['Broward'],
        risk_factors: ['income']
      };

      const result = await executePopulationHealthAnalysis(parameters, true);

      expect(result.success).toBe(true);
      expect(result.metadata.analysisType).toBe('population_health');
      expect(mockMCPServer.executeTool).toHaveBeenCalledWith('population_health_risk', parameters);
    });

    it('should execute facility analysis via convenience function', async () => {
      const parameters = {
        geography_type: 'county',
        geography_codes: ['Palm Beach'],
        facility_type: 'hospital'
      };

      const result = await executeFacilityAnalysis(parameters);

      expect(result.success).toBe(true);
      expect(result.metadata.analysisType).toBe('facility_adequacy');
      expect(mockMCPServer.executeTool).toHaveBeenCalledWith('facility_adequacy', parameters);
    });
  });
});