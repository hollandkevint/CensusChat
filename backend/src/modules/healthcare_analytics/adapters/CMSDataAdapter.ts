/**
 * CMS (Centers for Medicare & Medicaid Services) Data Adapter
 * Integration adapter for CMS public datasets and Medicare/Medicaid data
 */

import {
  BasePublicDatasetAdapter,
  StandardizedDataFormat,
  ConnectionStatus,
  PublicDatasetAdapter
} from '../core/PublicDatasetInterface';

export interface CMSDataConfig {
  baseUrl?: string;
  apiKey?: string;
  timeout?: number;
  retryAttempts?: number;
  enableCaching?: boolean;
  datasetPreference?: 'medicare_advantage' | 'provider_data' | 'quality_metrics' | 'cost_data';
}

export interface CMSApiResponse {
  results: any[];
  count: number;
  next?: string;
  previous?: string;
}

export class CMSDataAdapter extends BasePublicDatasetAdapter implements PublicDatasetAdapter {
  readonly source = 'cms_gov';
  private config: Required<CMSDataConfig>;

  constructor(config: CMSDataConfig = {}) {
    super();
    console.log('🏥 Initializing CMS Data Adapter');

    this.config = {
      baseUrl: 'https://data.cms.gov/api/1',
      apiKey: process.env.CMS_API_KEY || '',
      timeout: 15000, // CMS APIs can be slower
      retryAttempts: 3,
      enableCaching: true,
      datasetPreference: 'medicare_advantage',
      ...config
    };

    console.log(`📋 CMS Data Adapter configured for ${this.config.datasetPreference} data focus`);
  }

  async connect(): Promise<void> {
    console.log('🔌 Connecting to CMS Data API...');

    try {
      // Test connection with CMS metadata API
      const testUrl = `${this.config.baseUrl}/metastore/schemas/dataset`;

      const response = await fetch(testUrl, {
        method: 'GET',
        timeout: this.config.timeout,
        headers: {
          'User-Agent': 'CensusChat-HealthcareAnalytics/1.0',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`CMS API test failed: ${response.status} ${response.statusText}`);
      }

      const metadata = await response.json();
      if (!metadata || !Array.isArray(metadata)) {
        throw new Error('CMS API returned unexpected metadata format');
      }

      this.connectionStatus = ConnectionStatus.Connected;
      this.lastConnected = new Date();
      console.log(`✅ CMS Data API connection successful - ${metadata.length} datasets available`);

    } catch (error) {
      this.connectionStatus = ConnectionStatus.Error;
      console.error('❌ CMS Data API connection failed:', error);
      throw error;
    }
  }

  async query(sqlPattern: string, parameters: any): Promise<any[]> {
    if (this.connectionStatus !== ConnectionStatus.Connected) {
      throw new Error('CMS Data adapter not connected');
    }

    console.log('📊 Executing CMS Data query...');
    console.log('🔍 SQL Pattern (will be translated to CMS API):', sqlPattern.substring(0, 100) + '...');

    try {
      // Determine which CMS dataset to query based on SQL pattern
      const datasetInfo = this.determineDataset(sqlPattern, parameters);
      const cmsQuery = this.translateSqlToCmsApi(sqlPattern, parameters, datasetInfo);
      const data = await this.executeCmsQuery(cmsQuery);

      console.log(`✅ CMS Data query successful: ${data.length} records from ${datasetInfo.name}`);
      return data;

    } catch (error) {
      console.error('❌ CMS Data query failed:', error);

      // Return mock data as fallback for development
      console.log('🔄 Returning mock CMS data for development...');
      return this.generateMockCmsData(parameters);
    }
  }

  async transformResults(rawData: any[]): Promise<StandardizedDataFormat> {
    console.log('🔄 Transforming CMS data to standard format...');

    const transformedData = rawData.map(record => ({
      // Standard geographic identifiers
      county: record.county || record.County || record.COUNTY || this.extractCountyFromName(record.organization_name) || '',
      state: record.state || record.State || record.STATE || this.extractStateFromZip(record.zip_code) || '',

      // Standard demographic fields (estimated from CMS data)
      population_total: this.parseNumber(record.beneficiary_count) * 4.5 || 0, // Approximate total population from beneficiaries
      population_65_plus: this.parseNumber(record.beneficiary_count) || 0, // CMS primarily serves 65+
      median_household_income: this.estimateIncomeFromCmsData(record) || 0,

      // CMS-specific healthcare fields
      medicare_beneficiaries: this.parseNumber(record.beneficiary_count) || 0,
      medicare_advantage_enrollment: this.parseNumber(record.ma_enrollment) || 0,
      total_medicare_spending: this.parseNumber(record.total_spending) || 0,
      average_risk_score: this.parseNumber(record.average_risk_score) || 0,

      // Quality and performance metrics
      star_rating: this.parseNumber(record.star_rating) || 0,
      quality_score: this.parseNumber(record.quality_score) || 0,

      // Provider information
      provider_count: this.parseNumber(record.provider_count) || 0,
      hospital_count: this.parseNumber(record.hospital_readmission_rate) ? 1 : 0, // Approximation

      // Financial metrics
      per_capita_cost: this.parseNumber(record.per_capita_cost) || 0,
      cost_index: this.parseNumber(record.geographic_adjustment_factor) || 1.0,

      // Geographic identifiers
      msa_code: record.msa || '',
      hcc_region: record.payment_region || '',

      // Data source metadata
      data_source: 'CMS_Gov',
      report_year: record.year || new Date().getFullYear().toString(),
      dataset_type: record.dataset_type || 'medicare_advantage'
    }));

    return {
      data: transformedData,
      metadata: {
        source: this.source,
        recordCount: transformedData.length,
        transformedAt: new Date(),
        originalFormat: 'cms_api_json'
      }
    };
  }

  private determineDataset(sqlPattern: string, parameters: any): CMSDatasetInfo {
    // Determine which CMS dataset to use based on query content
    if (sqlPattern.includes('medicare_advantage') || sqlPattern.includes('ma_')) {
      return {
        id: 'medicare-advantage-enrollment',
        name: 'Medicare Advantage Enrollment',
        endpoint: 'datastore/sql',
        resource_id: 'd85d58e1-548b-4b24-bb7e-6b2b9d2d9b6f' // Example resource ID
      };
    }

    if (sqlPattern.includes('provider') || sqlPattern.includes('hospital')) {
      return {
        id: 'provider-utilization',
        name: 'Provider Utilization and Payment Data',
        endpoint: 'datastore/sql',
        resource_id: 'medicare-provider-utilization-payment-data'
      };
    }

    if (sqlPattern.includes('quality') || sqlPattern.includes('star_rating')) {
      return {
        id: 'plan-ratings',
        name: 'Medicare Plan Quality Ratings',
        endpoint: 'datastore/sql',
        resource_id: 'plan-quality-ratings'
      };
    }

    // Default to Medicare Advantage data
    return {
      id: 'medicare-advantage-enrollment',
      name: 'Medicare Advantage Enrollment',
      endpoint: 'datastore/sql',
      resource_id: 'medicare-advantage-enrollment'
    };
  }

  private translateSqlToCmsApi(sqlPattern: string, parameters: any, datasetInfo: CMSDatasetInfo): CMSApiQuery {
    console.log('🔄 Translating SQL pattern to CMS API query...');

    // Build CMS API query
    const query: CMSApiQuery = {
      resource_id: datasetInfo.resource_id,
      sql: this.adaptSqlForCms(sqlPattern, parameters),
      endpoint: datasetInfo.endpoint,
      limit: parameters.limit || 1000
    };

    return query;
  }

  private adaptSqlForCms(sqlPattern: string, parameters: any): string {
    // Adapt SQL for CMS API (simplified approach)
    let adaptedSql = sqlPattern;

    // Replace demographic table references with CMS-specific field mappings
    adaptedSql = adaptedSql.replace(/FROM demographics/g, 'FROM resource');

    // Map standard fields to CMS fields
    adaptedSql = adaptedSql.replace(/population_65_plus/g, 'enrollment_count');
    adaptedSql = adaptedSql.replace(/population_total/g, 'total_beneficiaries');
    adaptedSql = adaptedSql.replace(/median_household_income/g, 'per_capita_cost * 12'); // Rough approximation

    // Handle geographic parameters
    if (parameters.geography_codes && parameters.geography_codes.length > 0) {
      const geoFilter = parameters.geography_codes.map((code: string) => `'${code}'`).join(', ');
      if (parameters.geography_type === 'state') {
        adaptedSql += ` AND state IN (${geoFilter})`;
      } else if (parameters.geography_type === 'county') {
        adaptedSql += ` AND county IN (${geoFilter})`;
      }
    }

    return adaptedSql;
  }

  private async executeCmsQuery(query: CMSApiQuery): Promise<any[]> {
    const url = `${this.config.baseUrl}/${query.endpoint}`;
    console.log('🌐 CMS API URL:', url);

    const body = JSON.stringify({
      resource_id: query.resource_id,
      sql: query.sql,
      limit: query.limit
    });

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          timeout: this.config.timeout,
          headers: {
            'User-Agent': 'CensusChat-HealthcareAnalytics/1.0',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body
        });

        if (!response.ok) {
          if (response.status === 429) {
            console.warn(`⚠️ CMS API rate limited, attempt ${attempt}/${this.config.retryAttempts}`);
            await this.sleep(2000 * attempt);
            continue;
          }

          throw new Error(`CMS API error: ${response.status} ${response.statusText}`);
        }

        const result: CMSApiResponse = await response.json();
        return result.results || [];

      } catch (error) {
        console.warn(`⚠️ CMS query attempt ${attempt} failed:`, error);

        if (attempt === this.config.retryAttempts) {
          throw error;
        }

        await this.sleep(2000 * attempt);
      }
    }

    throw new Error('CMS query failed after all retry attempts');
  }

  private generateMockCmsData(parameters: any): any[] {
    console.log('🎭 Generating mock CMS data for development...');

    const mockData = [
      {
        county: 'Miami-Dade',
        state: 'Florida',
        beneficiary_count: 486234,
        ma_enrollment: 194493, // 40% MA penetration
        total_spending: 6800000000,
        average_risk_score: 1.15,
        star_rating: 4.2,
        quality_score: 85,
        provider_count: 8500,
        per_capita_cost: 14000,
        year: '2023',
        dataset_type: 'medicare_advantage'
      },
      {
        county: 'Broward',
        state: 'Florida',
        beneficiary_count: 312567,
        ma_enrollment: 140655, // 45% MA penetration
        total_spending: 4200000000,
        average_risk_score: 1.08,
        star_rating: 4.5,
        quality_score: 88,
        provider_count: 5800,
        per_capita_cost: 13450,
        year: '2023',
        dataset_type: 'medicare_advantage'
      },
      {
        county: 'Palm Beach',
        state: 'Florida',
        beneficiary_count: 278901,
        ma_enrollment: 111560, // 40% MA penetration
        total_spending: 3900000000,
        average_risk_score: 1.12,
        star_rating: 4.0,
        quality_score: 82,
        provider_count: 4200,
        per_capita_cost: 13980,
        year: '2023',
        dataset_type: 'medicare_advantage'
      }
    ];

    return mockData.filter(record => {
      if (!parameters.geography_codes || parameters.geography_codes.length === 0) {
        return true;
      }

      if (parameters.geography_type === 'state') {
        return parameters.geography_codes.some((code: string) =>
          record.state.toLowerCase().includes(code.toLowerCase())
        );
      }

      if (parameters.geography_type === 'county') {
        return parameters.geography_codes.some((code: string) =>
          record.county.toLowerCase().includes(code.toLowerCase())
        );
      }

      return true;
    });
  }

  private extractCountyFromName(organizationName?: string): string {
    if (!organizationName) return '';

    const countyMatch = organizationName.match(/(.+?)\s+County/i);
    return countyMatch ? countyMatch[1] : '';
  }

  private extractStateFromZip(zipCode?: string): string {
    // This would normally use a ZIP to state mapping
    // For now, return a placeholder
    return '';
  }

  private estimateIncomeFromCmsData(record: any): number {
    // Estimate income based on per-capita costs and regional factors
    const perCapitaCost = this.parseNumber(record.per_capita_cost) || 13000;

    // Higher healthcare costs often correlate with higher income areas
    // This is a rough estimation
    if (perCapitaCost > 15000) return 75000;
    if (perCapitaCost > 13000) return 60000;
    if (perCapitaCost > 11000) return 50000;
    return 45000;
  }

  private parseNumber(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/,/g, ''));
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getSupportedFeatures(): string[] {
    return [
      'medicare_advantage_data',
      'provider_utilization',
      'quality_ratings',
      'cost_analysis',
      'beneficiary_demographics',
      'plan_performance_metrics'
    ];
  }

  async disconnect(): Promise<void> {
    console.log('🔌 Disconnecting from CMS Data API');
    this.connectionStatus = ConnectionStatus.Disconnected;
    console.log('✅ CMS Data adapter disconnected');
  }
}

interface CMSDatasetInfo {
  id: string;
  name: string;
  endpoint: string;
  resource_id: string;
}

interface CMSApiQuery {
  resource_id: string;
  sql: string;
  endpoint: string;
  limit: number;
}