/**
 * Healthcare Analytics Module Types
 * Core type definitions for FDB-MCP implementation
 */

export interface QueryTranslationPattern {
  intent: 'healthcare_analytics' | 'demographics' | 'economic_indicators';
  entities: {
    geography: string[];
    metrics: string[];
    timeframe?: string;
  };
  sqlPattern: string;
  parameters: Record<string, any>;
}

export interface AnalysisResult {
  data: any[];
  metadata: {
    recordCount: number;
    executionTime: number;
    dataSource: string;
    confidenceLevel: number;
    queryPattern: string;
  };
}

export interface GeographicParams {
  geography_type: 'state' | 'county' | 'msa' | 'zip';
  geography_codes: string[];
  year?: string;
}

export interface RiskFactorParams {
  geography_type: 'state' | 'county';
  geography_codes: string[];
  risk_factors: ('income' | 'insurance' | 'age' | 'education')[];
}

export interface FacilityParams {
  geography_type: 'state' | 'county';
  geography_codes: string[];
  facility_type?: 'hospital' | 'clinic' | 'specialty' | 'all';
}

export interface RiskAnalysis {
  geography: string;
  state: string;
  county?: string;
  composite_risk_score: number;
  risk_category: 'Low Risk' | 'Moderate Risk' | 'High Risk';
  risk_factors: {
    income_risk_score: number;
    insurance_risk_score: number;
    age_risk_score?: number;
    education_risk_score?: number;
  };
}

export interface AdequacyMetrics {
  geography: string;
  state: string;
  county?: string;
  population_total: number;
  population_65_plus: number;
  facilities_count: number;
  facilities_per_10k: number;
  adequacy_rating: 'Underserved' | 'Adequately Served' | 'Well Served';
}

export interface StandardizedDataFormat {
  source: string;
  version: string;
  timestamp: Date;
  data: Record<string, any>[];
  schema: Record<string, string>;
}

export interface QueryRequest {
  naturalLanguageQuery: string;
  translatedPattern?: QueryTranslationPattern;
  parameters: Record<string, any>;
  cacheKey?: string;
}

export interface QueryResult {
  success: boolean;
  data: any[];
  metadata: {
    federatedSources: string[];
    executionTime: number;
    recordCount: number;
    queryPattern: string;
    confidenceLevel: number;
  };
  error?: string;
}

export interface PatternDefinition {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, any>;
  sqlTemplate: string;
  category: 'medicare' | 'population_health' | 'facility_adequacy' | 'demographics';
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestedCorrections?: string[];
}

export interface MCPHealthcareTools {
  medicare_eligibility_analysis: (params: GeographicParams) => Promise<AnalysisResult>;
  population_health_assessment: (params: RiskFactorParams) => Promise<RiskAnalysis>;
  facility_adequacy_calculator: (params: FacilityParams) => Promise<AdequacyMetrics>;
}

export interface PublicDatasetAdapter {
  source: 'census_bureau' | 'cms' | 'cdc' | 'bls';
  name: string;
  version: string;
  connect(): Promise<void>;
  query(pattern: string, params: any): Promise<any[]>;
  transformResults(rawData: any[]): Promise<StandardizedDataFormat>;
  healthCheck(): Promise<boolean>;
  disconnect(): Promise<void>;
}

export interface FederatedQueryOptions {
  timeout: number;
  retries: number;
  cacheTTL: number;
  preferredSources: string[];
  fallbackEnabled: boolean;
}

export interface HealthcareAnalyticsConfig {
  enableCaching: boolean;
  cacheTTLSeconds: number;
  maxConcurrentQueries: number;
  queryTimeoutSeconds: number;
  enableExternalDataSources: boolean;
  defaultRiskThresholds: {
    income: { low: number; high: number };
    insurance: { low: number; high: number };
    age: { low: number; high: number };
  };
}

// Dataset Federation Types
export interface DatasetFederatorConfig {
  defaultStrategy?: string;
  enableCaching?: boolean;
  cacheTimeoutMs?: number;
  maxConcurrentQueries?: number;
  queryTimeoutMs?: number;
  retryAttempts?: number;
}

export interface FederatedQueryResult {
  data: any[];
  metadata: {
    sources: string[];
    executionTime: number;
    recordCount: number;
    federationStrategy: string;
    sourcesAttempted: string[];
    confidenceLevel: number;
  };
}

export interface DataSourceMetadata {
  source: string;
  available: boolean;
  lastUpdated: Date;
  capabilities: string[];
  description: string;
}

export interface PerformanceMetrics {
  queryId: string;
  executionTime: number;
  dataSourcesUsed: string[];
  recordsProcessed: number;
  cacheHit: boolean;
  errors: string[];
  timestamp: Date;
}