/**
 * Natural Language Query Router
 * Semantic query translation engine for FDB-MCP
 */

import {
  QueryTranslationPattern,
  ValidationResult,
  PatternDefinition,
  HealthcareAnalyticsConfig
} from '../types/HealthcareAnalyticsTypes';

export interface SemanticAnalysis {
  intent: string;
  entities: {
    geography: string[];
    metrics: string[];
    timeframe?: string;
    demographics: string[];
  };
  confidence: number;
  context: Record<string, any>;
}

export class NaturalLanguageQueryRouter {
  private patterns: Map<string, PatternDefinition> = new Map();
  private config: HealthcareAnalyticsConfig;

  constructor(config: HealthcareAnalyticsConfig) {
    this.config = config;
    this.initializePatterns();
  }

  async translateQuery(query: string): Promise<QueryTranslationPattern> {
    console.log(`🔍 Translating natural language query: "${query.substring(0, 100)}..."`);

    const analysis = await this.analyzeSemanticIntent(query);
    const translatedPattern = await this.mapToSqlPattern(analysis);

    console.log(`✅ Query translation complete. Intent: ${translatedPattern.intent}, Entities: ${translatedPattern.entities.geography.length} geographies, ${translatedPattern.entities.metrics.length} metrics`);

    return translatedPattern;
  }

  async analyzeSemanticIntent(query: string): Promise<SemanticAnalysis> {
    const normalizedQuery = query.toLowerCase().trim();

    // Detect intent
    let intent = 'demographics'; // Default

    if (this.containsHealthcareKeywords(normalizedQuery)) {
      intent = 'healthcare_analytics';
    } else if (this.containsEconomicKeywords(normalizedQuery)) {
      intent = 'economic_indicators';
    }

    // Extract entities
    const geography = this.extractGeography(normalizedQuery);
    const metrics = this.extractMetrics(normalizedQuery);
    const timeframe = this.extractTimeframe(normalizedQuery);
    const demographics = this.extractDemographics(normalizedQuery);

    // Calculate confidence based on entity extraction success
    const confidence = this.calculateConfidence(geography, metrics, demographics);

    return {
      intent,
      entities: {
        geography,
        metrics,
        timeframe,
        demographics
      },
      confidence,
      context: {
        originalQuery: query,
        queryLength: query.length,
        entityCount: geography.length + metrics.length + demographics.length
      }
    };
  }

  async mapToSqlPattern(analysis: SemanticAnalysis): Promise<QueryTranslationPattern> {
    const { intent, entities, confidence } = analysis;

    // Select appropriate SQL pattern based on intent and entities
    let sqlPattern = '';
    let parameters: Record<string, any> = {};

    if (intent === 'healthcare_analytics') {
      if (entities.metrics.some(m => m.includes('medicare') || m.includes('senior'))) {
        sqlPattern = this.getMedicareEligibilityPattern();
        parameters.geography_type = 'county';
        parameters.geography_codes = entities.geography.length > 0 ? entities.geography : ['Florida'];
      } else if (entities.metrics.some(m => m.includes('health') || m.includes('risk'))) {
        sqlPattern = this.getPopulationHealthPattern();
        parameters.geography_type = 'county';
        parameters.geography_codes = entities.geography.length > 0 ? entities.geography : ['Florida'];
        parameters.risk_factors = ['income', 'insurance'];
      } else if (entities.metrics.some(m => m.includes('facility') || m.includes('hospital'))) {
        sqlPattern = this.getFacilityAdequacyPattern();
        parameters.geography_type = 'county';
        parameters.geography_codes = entities.geography.length > 0 ? entities.geography : ['Florida'];
      } else {
        // Default to demographics
        sqlPattern = this.getDemographicsPattern();
        parameters.geography_type = 'county';
        parameters.geography_codes = entities.geography.length > 0 ? entities.geography : ['Florida'];
      }
    } else {
      // Default demographics pattern
      sqlPattern = this.getDemographicsPattern();
      parameters.geography_type = 'county';
      parameters.geography_codes = entities.geography.length > 0 ? entities.geography : ['Florida'];
    }

    return {
      intent: intent as any,
      entities: {
        geography: entities.geography,
        metrics: entities.metrics,
        timeframe: entities.timeframe
      },
      sqlPattern,
      parameters
    };
  }

  validateQuery(query: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestedCorrections: string[] = [];

    // Basic validation
    if (!query || query.trim().length === 0) {
      errors.push('Query cannot be empty');
    }

    if (query.length < 3) {
      warnings.push('Query is very short, consider providing more details');
    }

    if (query.length > 500) {
      warnings.push('Query is very long, consider simplifying');
    }

    // Check for potentially problematic patterns
    if (query.toLowerCase().includes('all counties')) {
      warnings.push('Querying all counties may be slow, consider specifying a state');
      suggestedCorrections.push('Try: "Show me data for counties in California"');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestedCorrections
    };
  }

  private containsHealthcareKeywords(query: string): boolean {
    const healthcareKeywords = [
      'medicare', 'medicaid', 'health', 'healthcare', 'medical', 'hospital', 'clinic',
      'facility', 'senior', 'elderly', 'risk', 'population health', 'eligibility'
    ];

    return healthcareKeywords.some(keyword => query.includes(keyword));
  }

  private containsEconomicKeywords(query: string): boolean {
    const economicKeywords = [
      'income', 'poverty', 'employment', 'unemployment', 'economic', 'wage', 'salary'
    ];

    return economicKeywords.some(keyword => query.includes(keyword));
  }

  private extractGeography(query: string): string[] {
    const geography: string[] = [];

    // Common state names
    const states = [
      'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut',
      'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa',
      'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan',
      'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada',
      'new hampshire', 'new jersey', 'new mexico', 'new york', 'north carolina',
      'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania', 'rhode island',
      'south carolina', 'south dakota', 'tennessee', 'texas', 'utah', 'vermont',
      'virginia', 'washington', 'west virginia', 'wisconsin', 'wyoming'
    ];

    // Common county names
    const counties = [
      'miami-dade', 'broward', 'palm beach', 'orange', 'hillsborough', 'pinellas',
      'duval', 'polk', 'brevard', 'volusia', 'los angeles', 'cook', 'harris', 'maricopa'
    ];

    states.forEach(state => {
      if (query.includes(state)) {
        geography.push(state.split(' ').map(word =>
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' '));
      }
    });

    counties.forEach(county => {
      if (query.includes(county)) {
        geography.push(county.split('-').map(word =>
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join('-'));
      }
    });

    return [...new Set(geography)]; // Remove duplicates
  }

  private extractMetrics(query: string): string[] {
    const metrics: string[] = [];

    const metricMap = {
      'senior': 'population_65_plus',
      'elderly': 'population_65_plus',
      '65+': 'population_65_plus',
      'medicare': 'medicare_eligible',
      'income': 'median_household_income',
      'poverty': 'poverty_rate',
      'population': 'population_total',
      'facility': 'healthcare_facilities',
      'hospital': 'hospitals',
      'clinic': 'clinics'
    };

    Object.entries(metricMap).forEach(([keyword, metric]) => {
      if (query.includes(keyword)) {
        metrics.push(metric);
      }
    });

    return [...new Set(metrics)];
  }

  private extractTimeframe(query: string): string | undefined {
    const yearMatch = query.match(/\b(20\d{2})\b/);
    return yearMatch ? yearMatch[1] : undefined;
  }

  private extractDemographics(query: string): string[] {
    const demographics: string[] = [];

    const demographicKeywords = ['age', 'race', 'ethnicity', 'gender', 'education', 'insurance'];

    demographicKeywords.forEach(keyword => {
      if (query.includes(keyword)) {
        demographics.push(keyword);
      }
    });

    return demographics;
  }

  private calculateConfidence(geography: string[], metrics: string[], demographics: string[]): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on entity extraction success
    if (geography.length > 0) confidence += 0.2;
    if (metrics.length > 0) confidence += 0.2;
    if (demographics.length > 0) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  private getMedicareEligibilityPattern(): string {
    return `
      SELECT
        county,
        state,
        population_total,
        population_65_plus,
        ROUND(100.0 * population_65_plus / NULLIF(population_total, 0), 2) as medicare_eligible_rate,
        CASE
          WHEN population_65_plus / NULLIF(population_total, 0) > 0.20 THEN 'High Senior Population'
          WHEN population_65_plus / NULLIF(population_total, 0) > 0.15 THEN 'Moderate Senior Population'
          ELSE 'Low Senior Population'
        END as senior_population_category
      FROM demographics
      WHERE population_total > 0
        AND (:geography_type = 'county' OR state IN (:geography_codes))
      ORDER BY medicare_eligible_rate DESC
      LIMIT 50
    `;
  }

  private getPopulationHealthPattern(): string {
    return `
      WITH risk_factors AS (
        SELECT
          county, state, population_total,
          median_household_income,
          CASE
            WHEN median_household_income < 40000 THEN 3
            WHEN median_household_income < 60000 THEN 2
            ELSE 1
          END as income_risk_score,
          CASE
            WHEN population_65_plus / NULLIF(population_total, 0) > 0.20 THEN 2
            ELSE 1
          END as age_risk_score
        FROM demographics
        WHERE population_total > 0
      )
      SELECT
        county, state,
        income_risk_score + age_risk_score as composite_risk_score,
        CASE
          WHEN income_risk_score + age_risk_score >= 4 THEN 'High Risk'
          WHEN income_risk_score + age_risk_score >= 3 THEN 'Moderate Risk'
          ELSE 'Low Risk'
        END as risk_category,
        median_household_income
      FROM risk_factors
      WHERE (:geography_type = 'county' OR state IN (:geography_codes))
      ORDER BY composite_risk_score DESC
      LIMIT 50
    `;
  }

  private getFacilityAdequacyPattern(): string {
    return `
      SELECT
        county, state,
        population_total,
        population_65_plus,
        ROUND(population_total / 10000.0, 2) as estimated_facilities_per_10k,
        CASE
          WHEN population_total / 10000.0 < 5 THEN 'Underserved'
          WHEN population_total / 10000.0 > 15 THEN 'Well Served'
          ELSE 'Adequately Served'
        END as adequacy_rating
      FROM demographics
      WHERE population_total > 0
        AND (:geography_type = 'county' OR state IN (:geography_codes))
      ORDER BY estimated_facilities_per_10k ASC
      LIMIT 50
    `;
  }

  private getDemographicsPattern(): string {
    return `
      SELECT
        county,
        state,
        population_total,
        population_65_plus,
        median_household_income
      FROM demographics
      WHERE population_total > 0
        AND (:geography_type = 'county' OR state IN (:geography_codes))
      ORDER BY population_total DESC
      LIMIT 50
    `;
  }

  private initializePatterns(): void {
    // Initialize common patterns for reuse
    this.patterns.set('medicare_eligibility', {
      id: 'medicare_eligibility',
      name: 'Medicare Eligibility Analysis',
      description: 'Analyze Medicare eligibility rates by geography',
      parameters: { geography_type: 'string', geography_codes: 'array' },
      sqlTemplate: this.getMedicareEligibilityPattern(),
      category: 'medicare'
    });

    this.patterns.set('population_health', {
      id: 'population_health',
      name: 'Population Health Risk Assessment',
      description: 'Assess population health risks based on demographics',
      parameters: { geography_type: 'string', geography_codes: 'array', risk_factors: 'array' },
      sqlTemplate: this.getPopulationHealthPattern(),
      category: 'population_health'
    });

    this.patterns.set('facility_adequacy', {
      id: 'facility_adequacy',
      name: 'Healthcare Facility Adequacy',
      description: 'Analyze healthcare facility adequacy by population',
      parameters: { geography_type: 'string', geography_codes: 'array' },
      sqlTemplate: this.getFacilityAdequacyPattern(),
      category: 'facility_adequacy'
    });
  }
}