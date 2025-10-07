/**
 * Public Dataset Interface
 * Generic interface for FDB integration patterns
 */

import {
  PublicDatasetAdapter,
  StandardizedDataFormat,
  FederatedQueryOptions,
  QueryTranslationPattern
} from '../types/HealthcareAnalyticsTypes';

// Re-export important types for external use
export { PublicDatasetAdapter, StandardizedDataFormat } from '../types/HealthcareAnalyticsTypes';

export abstract class BasePublicDatasetAdapter implements PublicDatasetAdapter {
  abstract source: 'census_bureau' | 'cms' | 'cdc' | 'bls';
  abstract name: string;
  abstract version: string;

  protected isConnected: boolean = false;
  protected connectionError?: string;

  abstract connect(): Promise<void>;
  abstract query(pattern: string, params: any): Promise<any[]>;
  abstract transformResults(rawData: any[]): Promise<StandardizedDataFormat>;
  abstract disconnect(): Promise<void>;

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      // Simple ping query to verify connection
      const testResult = await this.query('SELECT 1 as test', {});
      return testResult && testResult.length > 0;
    } catch (error) {
      console.error(`Health check failed for ${this.name}:`, error);
      return false;
    }
  }

  protected validateConnection(): void {
    if (!this.isConnected) {
      throw new Error(`${this.name} adapter is not connected. Call connect() first.`);
    }
  }

  protected handleError(operation: string, error: any): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${this.name} ${operation} error:`, errorMessage);
    this.connectionError = errorMessage;
  }
}

export interface DatasetRegistry {
  adapters: Map<string, PublicDatasetAdapter>;
  registerAdapter(adapter: PublicDatasetAdapter): void;
  getAdapter(source: string): PublicDatasetAdapter | undefined;
  listAvailableAdapters(): string[];
  healthCheckAll(): Promise<Record<string, boolean>>;
}

export class PublicDatasetRegistry implements DatasetRegistry {
  public adapters: Map<string, PublicDatasetAdapter> = new Map();

  registerAdapter(adapter: PublicDatasetAdapter): void {
    console.log(`📊 Registering public dataset adapter: ${adapter.name} (${adapter.source})`);
    this.adapters.set(adapter.source, adapter);
  }

  getAdapter(source: string): PublicDatasetAdapter | undefined {
    return this.adapters.get(source as any);
  }

  listAvailableAdapters(): string[] {
    return Array.from(this.adapters.keys());
  }

  async healthCheckAll(): Promise<Record<string, boolean>> {
    const healthResults: Record<string, boolean> = {};

    for (const [source, adapter] of this.adapters) {
      try {
        healthResults[source] = await adapter.healthCheck();
      } catch (error) {
        console.error(`Health check failed for ${source}:`, error);
        healthResults[source] = false;
      }
    }

    return healthResults;
  }
}

export interface QueryOptimizer {
  optimizeQuery(pattern: QueryTranslationPattern): Promise<QueryTranslationPattern>;
  suggestIndices(pattern: QueryTranslationPattern): string[];
  estimateExecutionTime(pattern: QueryTranslationPattern): number;
}

export class DefaultQueryOptimizer implements QueryOptimizer {
  async optimizeQuery(pattern: QueryTranslationPattern): Promise<QueryTranslationPattern> {
    // Basic optimization strategies
    const optimizedPattern = { ...pattern };

    // Optimize geography filters
    if (pattern.entities.geography.length > 100) {
      console.warn('⚠️ Large geography list detected, consider using state-level aggregation');
    }

    // Optimize SQL pattern for common cases
    if (pattern.sqlPattern.includes('SELECT *')) {
      console.warn('⚠️ SELECT * detected, consider specifying explicit columns for better performance');
    }

    return optimizedPattern;
  }

  suggestIndices(pattern: QueryTranslationPattern): string[] {
    const indices: string[] = [];

    // Suggest geographical indices
    if (pattern.entities.geography.length > 0) {
      indices.push('CREATE INDEX IF NOT EXISTS idx_demographics_geography ON demographics(state, county)');
    }

    // Suggest metric-specific indices
    if (pattern.entities.metrics.includes('population_65_plus')) {
      indices.push('CREATE INDEX IF NOT EXISTS idx_demographics_seniors ON demographics(population_65_plus)');
    }

    if (pattern.entities.metrics.includes('median_household_income')) {
      indices.push('CREATE INDEX IF NOT EXISTS idx_demographics_income ON demographics(median_household_income)');
    }

    return indices;
  }

  estimateExecutionTime(pattern: QueryTranslationPattern): number {
    let estimatedMs = 100; // Base execution time

    // Add time based on complexity
    estimatedMs += pattern.entities.geography.length * 10; // Geography complexity
    estimatedMs += pattern.entities.metrics.length * 50;   // Metric complexity

    // Add time for SQL complexity
    const sqlComplexity = pattern.sqlPattern.split('JOIN').length - 1;
    estimatedMs += sqlComplexity * 200;

    return Math.min(estimatedMs, 2000); // Cap at 2 seconds per requirement
  }
}

// Singleton registry instance
let registryInstance: PublicDatasetRegistry | null = null;

export function getPublicDatasetRegistry(): PublicDatasetRegistry {
  if (!registryInstance) {
    registryInstance = new PublicDatasetRegistry();
  }
  return registryInstance;
}