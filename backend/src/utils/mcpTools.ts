import { getMCPServerService } from '../services/mcpServerService';
import { getMCPClientService } from '../services/mcpClientService';

export interface HealthcareAnalysisRequest {
  analysisType: 'medicare_eligibility' | 'population_health' | 'facility_adequacy';
  parameters: any;
  useExternalData?: boolean;
}

export interface HealthcareAnalysisResult {
  success: boolean;
  data: any[];
  metadata: {
    analysisType: string;
    executionTime: number;
    dataSource: string;
    recordCount: number;
  };
  error?: string;
}

export class HealthcareAnalyticsTools {

  /**
   * Execute healthcare analytics using MCP tools
   */
  static async executeAnalysis(request: HealthcareAnalysisRequest): Promise<HealthcareAnalysisResult> {
    const startTime = Date.now();

    try {
      let data: any[] = [];
      let dataSource = 'CensusChat Internal';

      const mcpServer = getMCPServerService();

      switch (request.analysisType) {
        case 'medicare_eligibility':
          data = await mcpServer.executeTool('calculate_medicare_eligibility', request.parameters);
          break;

        case 'population_health':
          data = await mcpServer.executeTool('population_health_risk', request.parameters);
          break;

        case 'facility_adequacy':
          data = await mcpServer.executeTool('facility_adequacy', request.parameters);
          break;

        default:
          throw new Error(`Unknown analysis type: ${request.analysisType}`);
      }

      // If external data requested, try to enrich with MCP client data
      if (request.useExternalData) {
        try {
          data = await this.enrichWithExternalData(request.analysisType, data, request.parameters);
          dataSource = 'CensusChat + External MCP';
        } catch (error) {
          console.warn('⚠️ External data enrichment failed, using internal data only:', error);
        }
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data,
        metadata: {
          analysisType: request.analysisType,
          executionTime,
          dataSource,
          recordCount: data.length
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        data: [],
        metadata: {
          analysisType: request.analysisType,
          executionTime,
          dataSource: 'Error',
          recordCount: 0
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Enrich internal data with external MCP sources
   */
  private static async enrichWithExternalData(
    analysisType: string,
    internalData: any[],
    parameters: any
  ): Promise<any[]> {
    const mcpClient = getMCPClientService();

    switch (analysisType) {
      case 'medicare_eligibility':
        return await this.enrichMedicareData(internalData, parameters, mcpClient);

      case 'population_health':
        return await this.enrichPopulationHealthData(internalData, parameters, mcpClient);

      case 'facility_adequacy':
        return await this.enrichFacilityData(internalData, parameters, mcpClient);

      default:
        return internalData;
    }
  }

  private static async enrichMedicareData(
    internalData: any[],
    parameters: any,
    mcpClient: any
  ): Promise<any[]> {
    try {
      // Get Medicare Advantage penetration data from external source
      const maData = await mcpClient.callTool({
        client: 'medicare_api',
        tool: 'get_ma_penetration',
        parameters: {
          geography: parameters.geography_type,
          year: parameters.year || new Date().getFullYear()
        }
      });

      // Merge internal and external data
      return internalData.map(row => {
        const maRecord = maData.find((ma: any) =>
          ma.county === row.county && ma.state === row.state
        );

        return {
          ...row,
          ma_enrollment_estimate: maRecord?.ma_enrollment_estimate || 0,
          ma_penetration_rate: maRecord?.ma_penetration_rate || 0,
          data_sources: ['CensusChat', 'Medicare API']
        };
      });

    } catch (error) {
      console.warn('⚠️ Failed to enrich Medicare data:', error);
      return internalData;
    }
  }

  private static async enrichPopulationHealthData(
    internalData: any[],
    parameters: any,
    mcpClient: any
  ): Promise<any[]> {
    try {
      // Get additional demographic data from Census API
      const censusData = await mcpClient.callTool({
        client: 'census_api',
        tool: 'get_demographics',
        parameters: {
          geography_type: parameters.geography_type,
          geography_codes: parameters.geography_codes
        }
      });

      // Merge with census data for additional health context
      return internalData.map(row => {
        const censusRecord = censusData.find((census: any) =>
          census.county === row.county && census.state === row.state
        );

        return {
          ...row,
          external_population_total: censusRecord?.population_total || row.population_total,
          external_median_income: censusRecord?.median_household_income || row.median_household_income,
          data_sources: ['CensusChat', 'Census API']
        };
      });

    } catch (error) {
      console.warn('⚠️ Failed to enrich population health data:', error);
      return internalData;
    }
  }

  private static async enrichFacilityData(
    internalData: any[],
    parameters: any,
    mcpClient: any
  ): Promise<any[]> {
    // For facility data, we would typically connect to healthcare facility databases
    // For now, return internal data with a note about data sources
    return internalData.map(row => ({
      ...row,
      data_sources: ['CensusChat'],
      note: 'External facility data integration available via MCP'
    }));
  }

  /**
   * Generate healthcare-specific prompt templates for MCP
   */
  static getHealthcarePromptTemplates(): Record<string, any> {
    return {
      medicare_eligibility_analysis: {
        name: 'Medicare Eligibility Analysis',
        description: 'Analyze Medicare eligibility patterns across geographic areas',
        template: `
          Analyze Medicare eligibility for {geography_type} level data.

          Parameters:
          - Geography: {geography_codes}
          - Analysis Year: {year}

          Please provide insights on:
          1. Medicare eligibility rates by area
          2. Senior population distribution
          3. Areas with highest/lowest eligibility
          4. Demographic factors affecting eligibility
        `,
        parameters: {
          geography_type: { type: 'string', required: true },
          geography_codes: { type: 'array', required: true },
          year: { type: 'integer', required: false }
        }
      },

      population_health_assessment: {
        name: 'Population Health Risk Assessment',
        description: 'Assess population health risks and identify intervention opportunities',
        template: `
          Perform population health risk assessment for {geography_type}.

          Parameters:
          - Geography: {geography_codes}
          - Risk Factors: {risk_factors}

          Analysis should include:
          1. Risk factor prevalence
          2. High-risk population identification
          3. Social determinants impact
          4. Intervention recommendations
        `,
        parameters: {
          geography_type: { type: 'string', required: true },
          geography_codes: { type: 'array', required: true },
          risk_factors: { type: 'array', required: true }
        }
      },

      facility_adequacy_analysis: {
        name: 'Healthcare Facility Adequacy Analysis',
        description: 'Analyze healthcare facility adequacy and access patterns',
        template: `
          Analyze healthcare facility adequacy for {geography_type}.

          Parameters:
          - Geography: {geography_codes}
          - Facility Type: {facility_type}

          Assessment should cover:
          1. Facility-to-population ratios
          2. Geographic access patterns
          3. Underserved area identification
          4. Capacity recommendations
        `,
        parameters: {
          geography_type: { type: 'string', required: true },
          geography_codes: { type: 'array', required: true },
          facility_type: { type: 'string', required: false }
        }
      }
    };
  }

  /**
   * Validate healthcare analysis parameters
   */
  static validateAnalysisParameters(analysisType: string, parameters: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Common validations
    if (!parameters.geography_type || !['state', 'county', 'zipcode'].includes(parameters.geography_type)) {
      errors.push('Valid geography_type required (state, county, or zipcode)');
    }

    if (!parameters.geography_codes || !Array.isArray(parameters.geography_codes) || parameters.geography_codes.length === 0) {
      errors.push('geography_codes array with at least one value required');
    }

    // Analysis-specific validations
    switch (analysisType) {
      case 'medicare_eligibility':
        if (parameters.year && (parameters.year < 2020 || parameters.year > new Date().getFullYear())) {
          errors.push('Year must be between 2020 and current year');
        }
        break;

      case 'population_health':
        if (!parameters.risk_factors || !Array.isArray(parameters.risk_factors) || parameters.risk_factors.length === 0) {
          errors.push('risk_factors array required for population health analysis');
        }

        const validRiskFactors = ['income', 'insurance', 'education', 'age', 'comorbidity'];
        const invalidFactors = parameters.risk_factors.filter((f: string) => !validRiskFactors.includes(f));
        if (invalidFactors.length > 0) {
          errors.push(`Invalid risk factors: ${invalidFactors.join(', ')}`);
        }
        break;

      case 'facility_adequacy':
        if (parameters.facility_type && !['hospital', 'clinic', 'pharmacy', 'all'].includes(parameters.facility_type)) {
          errors.push('facility_type must be hospital, clinic, pharmacy, or all');
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get available analysis types and their descriptions
   */
  static getAvailableAnalyses(): Record<string, string> {
    return {
      medicare_eligibility: 'Calculate Medicare eligibility rates and senior population analysis',
      population_health: 'Assess population health risk factors and social determinants',
      facility_adequacy: 'Analyze healthcare facility adequacy and access patterns'
    };
  }
}

// Export convenience functions for direct use
export async function executeMedicareAnalysis(parameters: any, useExternalData = false): Promise<HealthcareAnalysisResult> {
  return HealthcareAnalyticsTools.executeAnalysis({
    analysisType: 'medicare_eligibility',
    parameters,
    useExternalData
  });
}

export async function executePopulationHealthAnalysis(parameters: any, useExternalData = false): Promise<HealthcareAnalysisResult> {
  return HealthcareAnalyticsTools.executeAnalysis({
    analysisType: 'population_health',
    parameters,
    useExternalData
  });
}

export async function executeFacilityAnalysis(parameters: any, useExternalData = false): Promise<HealthcareAnalysisResult> {
  return HealthcareAnalyticsTools.executeAnalysis({
    analysisType: 'facility_adequacy',
    parameters,
    useExternalData
  });
}