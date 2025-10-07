/**
 * Dataset Federator
 * Generic system for federating queries across multiple public datasets
 */

import {
  PublicDatasetAdapter,
  StandardizedDataFormat,
  QueryTranslationPattern,
  DatasetFederatorConfig,
  FederatedQueryResult,
  DataSourceMetadata
} from '../types/HealthcareAnalyticsTypes';

export interface DatasetFederationStrategy {
  name: string;
  description: string;
  canHandle(pattern: QueryTranslationPattern): boolean;
  execute(pattern: QueryTranslationPattern, adapters: Map<string, PublicDatasetAdapter>): Promise<FederatedQueryResult>;
}

export class PrimaryWithFallbackStrategy implements DatasetFederationStrategy {
  name = 'primary_with_fallback';
  description = 'Try primary data source, fallback to secondary sources on failure';

  canHandle(pattern: QueryTranslationPattern): boolean {
    return true; // This strategy can handle any query pattern
  }

  async execute(pattern: QueryTranslationPattern, adapters: Map<string, PublicDatasetAdapter>): Promise<FederatedQueryResult> {
    const primaryAdapter = adapters.get('census_bureau');
    const fallbackAdapters = Array.from(adapters.values()).filter(adapter => adapter.source !== 'census_bureau');

    let result: FederatedQueryResult;
    const sourcesAttempted: string[] = [];

    // Try primary source first
    if (primaryAdapter) {
      try {
        console.log(`🎯 Attempting primary data source: ${primaryAdapter.source}`);
        const data = await primaryAdapter.query(pattern.sqlPattern, pattern.parameters);
        const standardized = await primaryAdapter.transformResults(data);

        sourcesAttempted.push(primaryAdapter.source);
        result = {
          data: standardized.data,
          metadata: {
            sources: [primaryAdapter.source],
            executionTime: Date.now(),
            recordCount: standardized.data.length,
            federationStrategy: this.name,
            sourcesAttempted,
            confidenceLevel: 0.95
          }
        };

        console.log(`✅ Primary source successful: ${standardized.data.length} records`);
        return result;

      } catch (error) {
        console.warn(`⚠️ Primary source failed: ${primaryAdapter.source}`, error);
        sourcesAttempted.push(primaryAdapter.source);
      }
    }

    // Try fallback sources
    for (const adapter of fallbackAdapters) {
      try {
        console.log(`🔄 Trying fallback source: ${adapter.source}`);
        const data = await adapter.query(pattern.sqlPattern, pattern.parameters);
        const standardized = await adapter.transformResults(data);

        sourcesAttempted.push(adapter.source);
        result = {
          data: standardized.data,
          metadata: {
            sources: [adapter.source],
            executionTime: Date.now(),
            recordCount: standardized.data.length,
            federationStrategy: this.name,
            sourcesAttempted,
            confidenceLevel: 0.85 // Lower confidence for fallback sources
          }
        };

        console.log(`✅ Fallback source successful: ${adapter.source}, ${standardized.data.length} records`);
        return result;

      } catch (error) {
        console.warn(`⚠️ Fallback source failed: ${adapter.source}`, error);
        sourcesAttempted.push(adapter.source);
      }
    }

    // All sources failed
    throw new Error(`All data sources failed. Attempted: ${sourcesAttempted.join(', ')}`);
  }
}

export class MultiSourceAggregationStrategy implements DatasetFederationStrategy {
  name = 'multi_source_aggregation';
  description = 'Query multiple sources and combine results';

  canHandle(pattern: QueryTranslationPattern): boolean {
    // Only handle patterns that can benefit from multi-source data
    return pattern.intent === 'healthcare_analytics' || pattern.intent === 'demographics';
  }

  async execute(pattern: QueryTranslationPattern, adapters: Map<string, PublicDatasetAdapter>): Promise<FederatedQueryResult> {
    const results: { source: string; data: any[]; confidence: number }[] = [];
    const sourcesAttempted: string[] = [];
    const successfulSources: string[] = [];

    // Query all available adapters
    for (const [sourceName, adapter] of adapters) {
      try {
        console.log(`🔍 Querying source: ${sourceName}`);
        sourcesAttempted.push(sourceName);

        const data = await adapter.query(pattern.sqlPattern, pattern.parameters);
        const standardized = await adapter.transformResults(data);

        results.push({
          source: sourceName,
          data: standardized.data,
          confidence: sourceName === 'census_bureau' ? 0.95 : 0.85
        });

        successfulSources.push(sourceName);
        console.log(`✅ Source ${sourceName} returned ${standardized.data.length} records`);

      } catch (error) {
        console.warn(`⚠️ Source ${sourceName} failed:`, error);
      }
    }

    if (results.length === 0) {
      throw new Error(`No data sources returned results. Attempted: ${sourcesAttempted.join(', ')}`);
    }

    // Aggregate results
    const aggregatedData = this.aggregateResults(results, pattern);
    const averageConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

    return {
      data: aggregatedData,
      metadata: {
        sources: successfulSources,
        executionTime: Date.now(),
        recordCount: aggregatedData.length,
        federationStrategy: this.name,
        sourcesAttempted,
        confidenceLevel: averageConfidence
      }
    };
  }

  private aggregateResults(results: { source: string; data: any[]; confidence: number }[], pattern: QueryTranslationPattern): any[] {
    if (results.length === 1) {
      return results[0].data;
    }

    // For healthcare analytics, prefer the most comprehensive dataset
    const sortedResults = results.sort((a, b) => {
      // Prefer census bureau data for consistency
      if (a.source === 'census_bureau') return -1;
      if (b.source === 'census_bureau') return 1;

      // Then by data size and confidence
      return (b.data.length * b.confidence) - (a.data.length * a.confidence);
    });

    // Use the highest quality result as the base
    let baseData = sortedResults[0].data;

    // Enrich with additional data from other sources where possible
    for (let i = 1; i < sortedResults.length; i++) {
      baseData = this.enrichData(baseData, sortedResults[i].data, sortedResults[i].source);
    }

    return baseData;
  }

  private enrichData(baseData: any[], enrichmentData: any[], source: string): any[] {
    // Simple enrichment strategy - add additional fields where geography matches
    const enrichmentMap = new Map();
    enrichmentData.forEach(record => {
      const key = `${record.county || record.geography || ''}_${record.state || ''}`;
      enrichmentMap.set(key, record);
    });

    return baseData.map(baseRecord => {
      const key = `${baseRecord.county || baseRecord.geography || ''}_${baseRecord.state || ''}`;
      const enrichment = enrichmentMap.get(key);

      if (enrichment) {
        return {
          ...baseRecord,
          [`${source}_data`]: enrichment,
          enriched_sources: (baseRecord.enriched_sources || []).concat([source])
        };
      }

      return baseRecord;
    });
  }
}

export class DatasetFederator {
  private adapters: Map<string, PublicDatasetAdapter> = new Map();
  private strategies: Map<string, DatasetFederationStrategy> = new Map();
  private config: DatasetFederatorConfig;

  constructor(config: DatasetFederatorConfig = {}) {
    console.log('🌐 Initializing Dataset Federator');

    this.config = {
      defaultStrategy: 'primary_with_fallback',
      enableCaching: true,
      cacheTimeoutMs: 300000, // 5 minutes
      maxConcurrentQueries: 5,
      queryTimeoutMs: 10000, // 10 seconds
      retryAttempts: 2,
      ...config
    };

    this.initializeStrategies();
    console.log('✅ Dataset Federator initialized');
  }

  private initializeStrategies(): void {
    this.strategies.set('primary_with_fallback', new PrimaryWithFallbackStrategy());
    this.strategies.set('multi_source_aggregation', new MultiSourceAggregationStrategy());

    console.log(`📋 Initialized ${this.strategies.size} federation strategies`);
  }

  async registerAdapter(adapter: PublicDatasetAdapter): Promise<void> {
    console.log(`📡 Registering dataset adapter: ${adapter.source}`);

    try {
      await adapter.connect();
      this.adapters.set(adapter.source, adapter);
      console.log(`✅ Adapter registered successfully: ${adapter.source}`);
    } catch (error) {
      console.error(`❌ Failed to register adapter ${adapter.source}:`, error);
      throw error;
    }
  }

  async executeDistributedQuery(pattern: QueryTranslationPattern, strategyName?: string): Promise<FederatedQueryResult> {
    const strategy = this.selectStrategy(pattern, strategyName);
    const startTime = Date.now();

    console.log(`🔄 Executing distributed query with strategy: ${strategy.name}`);
    console.log(`📊 Query pattern: ${pattern.intent}, Geography: ${pattern.entities.geography?.join(', ')}`);

    try {
      const result = await strategy.execute(pattern, this.adapters);
      const executionTime = Date.now() - startTime;

      result.metadata.executionTime = executionTime;

      console.log(`✅ Distributed query completed in ${executionTime}ms`);
      console.log(`📈 Retrieved ${result.metadata.recordCount} records from ${result.metadata.sources.length} sources`);

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`❌ Distributed query failed after ${executionTime}ms:`, error);
      throw error;
    }
  }

  private selectStrategy(pattern: QueryTranslationPattern, strategyName?: string): DatasetFederationStrategy {
    if (strategyName) {
      const strategy = this.strategies.get(strategyName);
      if (strategy && strategy.canHandle(pattern)) {
        return strategy;
      }
      console.warn(`⚠️ Requested strategy '${strategyName}' not available, using default`);
    }

    // Auto-select strategy based on pattern characteristics
    for (const strategy of this.strategies.values()) {
      if (strategy.canHandle(pattern)) {
        return strategy;
      }
    }

    // Fallback to default strategy
    const defaultStrategy = this.strategies.get(this.config.defaultStrategy!);
    if (!defaultStrategy) {
      throw new Error(`No federation strategy available for pattern: ${pattern.intent}`);
    }

    return defaultStrategy;
  }

  getAvailableAdapters(): string[] {
    return Array.from(this.adapters.keys());
  }

  getAvailableStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }

  async getDataSourceMetadata(): Promise<DataSourceMetadata[]> {
    const metadata: DataSourceMetadata[] = [];

    for (const [sourceName, adapter] of this.adapters) {
      try {
        const health = await adapter.healthCheck();
        metadata.push({
          source: adapter.source,
          available: health.healthy,
          lastUpdated: new Date(),
          capabilities: adapter.getSupportedFeatures?.() || [],
          description: `Public dataset adapter for ${sourceName}`
        });
      } catch (error) {
        metadata.push({
          source: adapter.source,
          available: false,
          lastUpdated: new Date(),
          capabilities: [],
          description: `Public dataset adapter for ${sourceName} (currently unavailable)`
        });
      }
    }

    return metadata;
  }

  async healthCheck(): Promise<{ healthy: boolean; adapters: Record<string, boolean>; strategies: string[] }> {
    const adapterHealth: Record<string, boolean> = {};

    for (const [sourceName, adapter] of this.adapters) {
      try {
        const health = await adapter.healthCheck();
        adapterHealth[sourceName] = health.healthy;
      } catch (error) {
        adapterHealth[sourceName] = false;
      }
    }

    const healthyAdapters = Object.values(adapterHealth).filter(h => h).length;
    const totalAdapters = Object.keys(adapterHealth).length;

    return {
      healthy: healthyAdapters > 0, // At least one adapter must be healthy
      adapters: adapterHealth,
      strategies: this.getAvailableStrategies()
    };
  }

  getConfig(): DatasetFederatorConfig {
    return { ...this.config };
  }

  async shutdown(): Promise<void> {
    console.log('🔌 Shutting down Dataset Federator');

    for (const [sourceName, adapter] of this.adapters) {
      try {
        if (adapter.disconnect) {
          await adapter.disconnect();
        }
        console.log(`✅ Disconnected from ${sourceName}`);
      } catch (error) {
        console.warn(`⚠️ Error disconnecting from ${sourceName}:`, error);
      }
    }

    this.adapters.clear();
    console.log('✅ Dataset Federator shutdown complete');
  }
}

// Singleton instance
let datasetFederatorInstance: DatasetFederator | null = null;

export function getDatasetFederator(config?: DatasetFederatorConfig): DatasetFederator {
  if (!datasetFederatorInstance) {
    datasetFederatorInstance = new DatasetFederator(config);
  }
  return datasetFederatorInstance;
}

export function resetDatasetFederator(): void {
  if (datasetFederatorInstance) {
    datasetFederatorInstance.shutdown();
    datasetFederatorInstance = null;
  }
}