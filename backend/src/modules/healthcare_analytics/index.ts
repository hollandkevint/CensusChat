/**
 * Healthcare Analytics Module - FDB-MCP Implementation
 * Main export file for the healthcare analytics module
 */

// Core Components
export { NaturalLanguageQueryRouter } from './core/NaturalLanguageQueryRouter';
export { MCPConnector } from './core/MCPConnector';
export {
  BasePublicDatasetAdapter,
  PublicDatasetRegistry,
  DefaultQueryOptimizer,
  getPublicDatasetRegistry
} from './core/PublicDatasetInterface';

// Types
export * from './types/HealthcareAnalyticsTypes';

// Main Healthcare Analytics Module Class
import { NaturalLanguageQueryRouter } from './core/NaturalLanguageQueryRouter';
import { MCPConnector } from './core/MCPConnector';
import { getPublicDatasetRegistry } from './core/PublicDatasetInterface';
import {
  QueryRequest,
  QueryResult,
  HealthcareAnalyticsConfig,
  QueryTranslationPattern
} from './types/HealthcareAnalyticsTypes';
import { dataFreshnessTracker } from '../../utils/dataFreshnessTracker';

export class HealthcareAnalyticsModule {
  private queryRouter: NaturalLanguageQueryRouter;
  private mcpConnector: MCPConnector;
  private config: HealthcareAnalyticsConfig;

  constructor(config?: Partial<HealthcareAnalyticsConfig>) {
    console.log('🏥 Initializing Healthcare Analytics Module');

    this.config = {
      enableCaching: true,
      cacheTTLSeconds: 300, // 5 minutes
      maxConcurrentQueries: 10,
      queryTimeoutSeconds: 2,
      enableExternalDataSources: false, // Start with internal data only
      defaultRiskThresholds: {
        income: { low: 40000, high: 80000 },
        insurance: { low: 5, high: 15 },
        age: { low: 15, high: 25 }
      },
      ...config
    };

    this.queryRouter = new NaturalLanguageQueryRouter(this.config);
    this.mcpConnector = new MCPConnector();

    // Initialize data freshness tracking for healthcare datasets
    dataFreshnessTracker.initializeHealthcareDatasets();

    console.log('✅ Healthcare Analytics Module initialized');
  }

  async executeQuery(request: QueryRequest): Promise<QueryResult> {
    const startTime = Date.now();
    console.log(`🔍 Executing healthcare analytics query: "${request.naturalLanguageQuery.substring(0, 100)}..."`);

    try {
      // Step 1: Translate natural language to SQL pattern
      let translatedPattern: QueryTranslationPattern;

      if (request.translatedPattern) {
        translatedPattern = request.translatedPattern;
        console.log('📋 Using pre-translated query pattern');
      } else {
        translatedPattern = await this.queryRouter.translateQuery(request.naturalLanguageQuery);
        console.log('🔄 Query translation completed');
      }

      // Step 2: Execute through appropriate channel
      let data: any[] = [];
      let dataSource = 'CensusChat Internal';

      if (translatedPattern.intent === 'healthcare_analytics') {
        // Use MCP tools for healthcare-specific queries
        console.log('🏥 Executing healthcare analytics query through MCP tools');

        const analysisType = this.determineAnalysisType(translatedPattern);
        const mcpResult = await this.mcpConnector.executeMCPTool(analysisType, translatedPattern.parameters);

        if (mcpResult && mcpResult.result) {
          data = Array.isArray(mcpResult.result.data) ? mcpResult.result.data : mcpResult.result;
          dataSource = mcpResult.metadata.dataSource;
        }
      } else {
        // Use direct database query for general demographics
        console.log('📊 Executing general demographics query');
        data = await this.executeDirectQuery(translatedPattern);
        dataSource = 'CensusChat Demographics Database';
      }

      const executionTime = Date.now() - startTime;

      // Get data freshness information
      const freshnessReport = dataFreshnessTracker.getDataFreshnessReport();
      const relevantDatasets = this.getRelevantDatasets(translatedPattern);

      const result: QueryResult = {
        success: true,
        data,
        metadata: {
          federatedSources: [dataSource],
          executionTime,
          recordCount: data.length,
          queryPattern: translatedPattern.sqlPattern.substring(0, 100),
          confidenceLevel: 0.95,
          dataFreshness: {
            overallStatus: freshnessReport.overallStatus,
            lastGlobalRefresh: freshnessReport.lastGlobalRefresh,
            relevantDatasets: relevantDatasets.map(dataset => ({
              name: dataset,
              age: dataFreshnessTracker.getDataAgeString(dataset),
              status: dataFreshnessTracker.getDatasetFreshness(dataset)?.status || 'unknown'
            })),
            recommendations: freshnessReport.recommendations
          }
        }
      };

      console.log(`✅ Healthcare analytics query completed in ${executionTime}ms, ${data.length} records`);
      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      console.error('❌ Healthcare analytics query failed:', errorMessage);

      return {
        success: false,
        data: [],
        metadata: {
          federatedSources: [],
          executionTime,
          recordCount: 0,
          queryPattern: '',
          confidenceLevel: 0
        },
        error: errorMessage
      };
    }
  }

  private determineAnalysisType(pattern: QueryTranslationPattern): string {
    const metrics = pattern.entities.metrics.join(' ').toLowerCase();

    if (metrics.includes('medicare') || metrics.includes('senior') || metrics.includes('65')) {
      return 'medicare_eligibility_analysis';
    } else if (metrics.includes('health') || metrics.includes('risk')) {
      return 'population_health_assessment';
    } else if (metrics.includes('facility') || metrics.includes('hospital')) {
      return 'facility_adequacy_calculator';
    }

    // Default to medicare eligibility for healthcare analytics
    return 'medicare_eligibility_analysis';
  }

  private async executeDirectQuery(pattern: QueryTranslationPattern): Promise<any[]> {
    // For now, return mock data since we're focused on the FDB-MCP architecture
    // In a production environment, this would connect to the actual DuckDB pool
    console.log('📋 Executing direct query with pattern:', pattern.sqlPattern.substring(0, 100));

    // Mock data that matches the expected structure
    return [
      {
        county: 'Miami-Dade',
        state: 'Florida',
        population_total: 2716940,
        population_65_plus: 486234,
        median_household_income: 52800,
        medicare_eligible_rate: 17.9
      },
      {
        county: 'Broward',
        state: 'Florida',
        population_total: 1944375,
        population_65_plus: 312567,
        median_household_income: 59734,
        medicare_eligible_rate: 16.1
      },
      {
        county: 'Palm Beach',
        state: 'Florida',
        population_total: 1496770,
        population_65_plus: 278901,
        median_household_income: 64863,
        medicare_eligible_rate: 18.6
      }
    ];
  }

  async validateQuery(query: string): Promise<{ isValid: boolean; errors: string[] }> {
    const validation = this.queryRouter.validateQuery(query);
    return {
      isValid: validation.isValid,
      errors: validation.errors
    };
  }

  async getAvailablePatterns(): Promise<string[]> {
    return [
      'medicare_eligibility_analysis',
      'population_health_assessment',
      'facility_adequacy_calculator'
    ];
  }

  async healthCheck(): Promise<{ healthy: boolean; components: Record<string, boolean> }> {
    const mcpHealth = await this.mcpConnector.healthCheck();

    return {
      healthy: mcpHealth.healthy,
      components: {
        queryRouter: true, // Always healthy as it's local
        mcpConnector: mcpHealth.healthy,
        dataRegistry: true // Will be implemented with adapters
      }
    };
  }

  getConfig(): HealthcareAnalyticsConfig {
    return { ...this.config };
  }

  /**
   * Determine which datasets are relevant for a given query pattern
   */
  private getRelevantDatasets(pattern: QueryTranslationPattern): string[] {
    const datasets: string[] = [];

    // Always include core datasets
    datasets.push('census_variables');

    // Determine geography-based datasets
    const geography = pattern.entities.geography.join(' ').toLowerCase();
    if (geography.includes('zip') || geography.includes('postal')) {
      datasets.push('zip5_demographics');
    }
    if (geography.includes('block') || geography.includes('tract')) {
      datasets.push('block_group_demographics');
    }

    // Determine healthcare-specific datasets
    const metrics = pattern.entities.metrics.join(' ').toLowerCase();
    if (metrics.includes('medicare') || metrics.includes('senior')) {
      datasets.push('medicare_eligibility');
    }
    if (metrics.includes('health') || metrics.includes('risk')) {
      datasets.push('population_health');
    }
    if (metrics.includes('facility') || metrics.includes('hospital')) {
      datasets.push('facility_adequacy');
    }

    // Always include healthcare patterns for healthcare analytics
    if (pattern.intent === 'healthcare_analytics') {
      datasets.push('healthcare_patterns');
    }

    return datasets;
  }
}

// Singleton instance for the healthcare analytics module
let healthcareAnalyticsInstance: HealthcareAnalyticsModule | null = null;

export function getHealthcareAnalyticsModule(config?: Partial<HealthcareAnalyticsConfig>): HealthcareAnalyticsModule {
  if (!healthcareAnalyticsInstance) {
    healthcareAnalyticsInstance = new HealthcareAnalyticsModule(config);
  }
  return healthcareAnalyticsInstance;
}

export function resetHealthcareAnalyticsModule(): void {
  healthcareAnalyticsInstance = null;
}