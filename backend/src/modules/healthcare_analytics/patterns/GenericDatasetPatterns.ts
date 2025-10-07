/**
 * Generic Dataset Patterns - Extensible patterns for education, transportation, environment datasets
 * Demonstrates FDB-MCP framework applicability beyond healthcare
 */

import { QueryTranslationPattern, PublicDatasetAdapter, StandardizedDataFormat } from '../types/HealthcareAnalyticsTypes';

export interface GenericDatasetConfig {
  domain: 'education' | 'transportation' | 'environment' | 'economics' | 'housing';
  primaryDataSource: string;
  fallbackSources: string[];
  commonGeographies: string[];
  standardMetrics: string[];
  temporalGranularity: 'yearly' | 'monthly' | 'daily';
}

export interface DatasetPattern {
  name: string;
  domain: string;
  description: string;
  intent: string;
  sqlTemplate: string;
  parameters: string[];
  geographyTypes: string[];
  metrics: string[];
  complexity: 'simple' | 'medium' | 'complex';
  estimatedExecutionTime: number;
}

export class GenericDatasetPatterns {
  private patterns: Map<string, DatasetPattern[]> = new Map();

  constructor() {
    this.initializeEducationPatterns();
    this.initializeTransportationPatterns();
    this.initializeEnvironmentPatterns();
    this.initializeEconomicsPatterns();
    this.initializeHousingPatterns();

    console.log('🌐 Generic Dataset Patterns initialized for multi-domain FDB-MCP extension');
  }

  /**
   * Initialize education dataset patterns
   */
  private initializeEducationPatterns(): void {
    const educationPatterns: DatasetPattern[] = [
      {
        name: 'school_district_performance',
        domain: 'education',
        description: 'Analyze school district academic performance metrics',
        intent: 'education_analytics',
        sqlTemplate: `
          SELECT
            district_name, county, state,
            total_students, graduation_rate, test_scores_math, test_scores_reading,
            per_pupil_spending, teacher_student_ratio,
            ROUND(graduation_rate, 2) as grad_rate_pct,
            CASE
              WHEN graduation_rate >= 90 THEN 'Excellent'
              WHEN graduation_rate >= 80 THEN 'Good'
              WHEN graduation_rate >= 70 THEN 'Fair'
              ELSE 'Needs Improvement'
            END as performance_tier
          FROM education_districts
          WHERE county IN ({geography})
            AND school_year = {year}
          ORDER BY graduation_rate DESC, test_scores_math DESC
        `,
        parameters: ['geography', 'year'],
        geographyTypes: ['county', 'state', 'district'],
        metrics: ['graduation_rate', 'test_scores', 'per_pupil_spending', 'teacher_ratio'],
        complexity: 'medium',
        estimatedExecutionTime: 800
      },
      {
        name: 'educational_attainment_demographics',
        domain: 'education',
        description: 'Population educational attainment analysis',
        intent: 'education_demographics',
        sqlTemplate: `
          SELECT
            county, state,
            total_population_25_plus,
            less_than_high_school, high_school_graduate, some_college,
            associates_degree, bachelors_degree, graduate_degree,
            ROUND((bachelors_degree + graduate_degree)::float / total_population_25_plus * 100, 2) as college_plus_rate,
            ROUND(high_school_graduate::float / total_population_25_plus * 100, 2) as hs_completion_rate
          FROM educational_attainment
          WHERE county IN ({geography})
            AND year = {year}
          ORDER BY college_plus_rate DESC
        `,
        parameters: ['geography', 'year'],
        geographyTypes: ['county', 'state', 'metro'],
        metrics: ['educational_attainment', 'college_completion', 'high_school_completion'],
        complexity: 'simple',
        estimatedExecutionTime: 400
      },
      {
        name: 'school_funding_equity_analysis',
        domain: 'education',
        description: 'Analyze funding equity across school districts',
        intent: 'education_analytics',
        sqlTemplate: `
          SELECT
            state,
            AVG(per_pupil_spending) as avg_spending,
            STDDEV(per_pupil_spending) as spending_variation,
            MIN(per_pupil_spending) as min_spending,
            MAX(per_pupil_spending) as max_spending,
            MAX(per_pupil_spending) - MIN(per_pupil_spending) as spending_gap,
            ROUND(AVG(free_reduced_lunch_pct), 2) as avg_poverty_rate
          FROM education_districts
          WHERE state IN ({geography})
            AND school_year = {year}
          GROUP BY state
          HAVING COUNT(*) >= 10  -- States with at least 10 districts
          ORDER BY spending_gap DESC
        `,
        parameters: ['geography', 'year'],
        geographyTypes: ['state', 'region'],
        metrics: ['funding_equity', 'per_pupil_spending', 'poverty_rates'],
        complexity: 'complex',
        estimatedExecutionTime: 1200
      }
    ];

    this.patterns.set('education', educationPatterns);
  }

  /**
   * Initialize transportation dataset patterns
   */
  private initializeTransportationPatterns(): void {
    const transportationPatterns: DatasetPattern[] = [
      {
        name: 'commute_patterns_analysis',
        domain: 'transportation',
        description: 'Analyze commuting patterns and transportation modes',
        intent: 'transportation_analytics',
        sqlTemplate: `
          SELECT
            county, state,
            total_commuters,
            drove_alone, carpooled, public_transportation, walked, other_means,
            worked_from_home, mean_commute_time,
            ROUND(drove_alone::float / total_commuters * 100, 2) as drive_alone_pct,
            ROUND(public_transportation::float / total_commuters * 100, 2) as transit_pct,
            ROUND(worked_from_home::float / total_commuters * 100, 2) as wfh_pct
          FROM commute_data
          WHERE county IN ({geography})
            AND year = {year}
          ORDER BY mean_commute_time DESC
        `,
        parameters: ['geography', 'year'],
        geographyTypes: ['county', 'metro', 'state'],
        metrics: ['commute_time', 'transportation_mode', 'work_from_home'],
        complexity: 'medium',
        estimatedExecutionTime: 600
      },
      {
        name: 'public_transit_accessibility',
        domain: 'transportation',
        description: 'Evaluate public transportation accessibility and coverage',
        intent: 'transportation_analytics',
        sqlTemplate: `
          SELECT
            metro_area, state,
            total_population, transit_routes, bus_stops, rail_stations,
            service_area_sq_miles, daily_ridership,
            ROUND(bus_stops::float / (total_population / 1000), 2) as stops_per_1k_pop,
            ROUND(daily_ridership::float / total_population * 100, 2) as ridership_rate,
            CASE
              WHEN stops_per_1k_pop >= 2.0 THEN 'High Access'
              WHEN stops_per_1k_pop >= 1.0 THEN 'Medium Access'
              WHEN stops_per_1k_pop >= 0.5 THEN 'Low Access'
              ELSE 'Very Low Access'
            END as accessibility_tier
          FROM transit_systems
          WHERE metro_area IN ({geography})
            AND year = {year}
          ORDER BY stops_per_1k_pop DESC
        `,
        parameters: ['geography', 'year'],
        geographyTypes: ['metro', 'county', 'state'],
        metrics: ['transit_accessibility', 'ridership', 'coverage'],
        complexity: 'complex',
        estimatedExecutionTime: 900
      },
      {
        name: 'traffic_congestion_index',
        domain: 'transportation',
        description: 'Traffic congestion and road infrastructure analysis',
        intent: 'transportation_analytics',
        sqlTemplate: `
          SELECT
            metro_area, state,
            population, total_road_miles, interstate_miles, bridge_count,
            avg_congestion_index, peak_hour_delay_per_commuter,
            road_condition_rating, bridge_condition_rating,
            ROUND(total_road_miles / (population / 1000), 2) as road_miles_per_1k_pop,
            ROUND(avg_congestion_index * peak_hour_delay_per_commuter, 2) as congestion_impact_score
          FROM traffic_infrastructure
          WHERE metro_area IN ({geography})
            AND year = {year}
          ORDER BY congestion_impact_score DESC
        `,
        parameters: ['geography', 'year'],
        geographyTypes: ['metro', 'state'],
        metrics: ['congestion_index', 'infrastructure_condition', 'delay_time'],
        complexity: 'medium',
        estimatedExecutionTime: 700
      }
    ];

    this.patterns.set('transportation', transportationPatterns);
  }

  /**
   * Initialize environment dataset patterns
   */
  private initializeEnvironmentPatterns(): void {
    const environmentPatterns: DatasetPattern[] = [
      {
        name: 'air_quality_monitoring',
        domain: 'environment',
        description: 'Air quality index and pollution monitoring',
        intent: 'environmental_analytics',
        sqlTemplate: `
          SELECT
            county, state, monitoring_date,
            aqi_value, primary_pollutant, pm25_concentration, ozone_concentration,
            CASE
              WHEN aqi_value <= 50 THEN 'Good'
              WHEN aqi_value <= 100 THEN 'Moderate'
              WHEN aqi_value <= 150 THEN 'Unhealthy for Sensitive Groups'
              WHEN aqi_value <= 200 THEN 'Unhealthy'
              WHEN aqi_value <= 300 THEN 'Very Unhealthy'
              ELSE 'Hazardous'
            END as air_quality_category,
            ROUND(AVG(aqi_value) OVER (
              PARTITION BY county, state
              ORDER BY monitoring_date
              ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
            ), 2) as seven_day_avg_aqi
          FROM air_quality_data
          WHERE county IN ({geography})
            AND monitoring_date BETWEEN {start_date} AND {end_date}
          ORDER BY monitoring_date DESC, aqi_value DESC
        `,
        parameters: ['geography', 'start_date', 'end_date'],
        geographyTypes: ['county', 'metro', 'state'],
        metrics: ['air_quality_index', 'pollutant_levels', 'health_impact'],
        complexity: 'medium',
        estimatedExecutionTime: 800
      },
      {
        name: 'climate_resilience_indicators',
        domain: 'environment',
        description: 'Climate change vulnerability and resilience metrics',
        intent: 'environmental_analytics',
        sqlTemplate: `
          SELECT
            county, state,
            avg_temperature, precipitation_annual, extreme_weather_events,
            flood_risk_score, wildfire_risk_score, drought_risk_score,
            green_infrastructure_score, renewable_energy_adoption,
            (flood_risk_score + wildfire_risk_score + drought_risk_score) / 3 as composite_risk_score,
            CASE
              WHEN green_infrastructure_score >= 80 THEN 'High Resilience'
              WHEN green_infrastructure_score >= 60 THEN 'Medium Resilience'
              WHEN green_infrastructure_score >= 40 THEN 'Low Resilience'
              ELSE 'Very Low Resilience'
            END as resilience_category
          FROM climate_data
          WHERE county IN ({geography})
            AND year = {year}
          ORDER BY composite_risk_score DESC, green_infrastructure_score ASC
        `,
        parameters: ['geography', 'year'],
        geographyTypes: ['county', 'state', 'region'],
        metrics: ['climate_risk', 'resilience_score', 'adaptation_measures'],
        complexity: 'complex',
        estimatedExecutionTime: 1100
      },
      {
        name: 'water_quality_assessment',
        domain: 'environment',
        description: 'Water quality and availability assessment',
        intent: 'environmental_analytics',
        sqlTemplate: `
          SELECT
            watershed, county, state,
            water_availability_index, groundwater_level, surface_water_quality,
            contamination_incidents, treatment_plant_capacity,
            population_served, per_capita_water_use,
            ROUND(treatment_plant_capacity::float / population_served, 2) as treatment_capacity_per_person,
            CASE
              WHEN surface_water_quality >= 85 THEN 'Excellent'
              WHEN surface_water_quality >= 70 THEN 'Good'
              WHEN surface_water_quality >= 55 THEN 'Fair'
              ELSE 'Poor'
            END as water_quality_grade
          FROM water_systems
          WHERE county IN ({geography})
            AND assessment_year = {year}
          ORDER BY water_availability_index DESC, surface_water_quality DESC
        `,
        parameters: ['geography', 'year'],
        geographyTypes: ['county', 'watershed', 'state'],
        metrics: ['water_availability', 'water_quality', 'infrastructure_capacity'],
        complexity: 'medium',
        estimatedExecutionTime: 750
      }
    ];

    this.patterns.set('environment', environmentPatterns);
  }

  /**
   * Initialize economics dataset patterns
   */
  private initializeEconomicsPatterns(): void {
    const economicsPatterns: DatasetPattern[] = [
      {
        name: 'regional_economic_indicators',
        domain: 'economics',
        description: 'Regional economic performance and growth indicators',
        intent: 'economic_analytics',
        sqlTemplate: `
          SELECT
            county, state,
            gdp_per_capita, median_household_income, unemployment_rate,
            job_growth_rate, business_establishments, labor_force_participation,
            cost_of_living_index, housing_cost_burden,
            ROUND(gdp_per_capita / (median_household_income / 12), 2) as gdp_to_income_ratio,
            CASE
              WHEN unemployment_rate <= 3.5 THEN 'Very Low'
              WHEN unemployment_rate <= 5.0 THEN 'Low'
              WHEN unemployment_rate <= 7.0 THEN 'Moderate'
              ELSE 'High'
            END as unemployment_category
          FROM economic_indicators
          WHERE county IN ({geography})
            AND year = {year}
          ORDER BY gdp_per_capita DESC, unemployment_rate ASC
        `,
        parameters: ['geography', 'year'],
        geographyTypes: ['county', 'metro', 'state'],
        metrics: ['gdp_per_capita', 'employment', 'business_growth'],
        complexity: 'medium',
        estimatedExecutionTime: 650
      }
    ];

    this.patterns.set('economics', economicsPatterns);
  }

  /**
   * Initialize housing dataset patterns
   */
  private initializeHousingPatterns(): void {
    const housingPatterns: DatasetPattern[] = [
      {
        name: 'housing_affordability_analysis',
        domain: 'housing',
        description: 'Housing affordability and market dynamics',
        intent: 'housing_analytics',
        sqlTemplate: `
          SELECT
            county, state,
            median_home_value, median_rent, median_household_income,
            homeownership_rate, housing_units, vacant_units,
            ROUND(median_home_value::float / median_household_income, 2) as price_to_income_ratio,
            ROUND(median_rent * 12::float / median_household_income * 100, 2) as rent_burden_pct,
            ROUND(vacant_units::float / housing_units * 100, 2) as vacancy_rate,
            CASE
              WHEN price_to_income_ratio <= 3.0 THEN 'Affordable'
              WHEN price_to_income_ratio <= 5.0 THEN 'Moderately Affordable'
              WHEN price_to_income_ratio <= 7.0 THEN 'Less Affordable'
              ELSE 'Least Affordable'
            END as affordability_category
          FROM housing_data
          WHERE county IN ({geography})
            AND year = {year}
          ORDER BY price_to_income_ratio DESC
        `,
        parameters: ['geography', 'year'],
        geographyTypes: ['county', 'metro', 'state'],
        metrics: ['home_values', 'affordability', 'rental_market'],
        complexity: 'medium',
        estimatedExecutionTime: 550
      }
    ];

    this.patterns.set('housing', housingPatterns);
  }

  /**
   * Get patterns for a specific domain
   */
  getPatternsForDomain(domain: string): DatasetPattern[] {
    return this.patterns.get(domain) || [];
  }

  /**
   * Get all available domains
   */
  getAvailableDomains(): string[] {
    return Array.from(this.patterns.keys());
  }

  /**
   * Find patterns by complexity
   */
  getPatternsByComplexity(complexity: 'simple' | 'medium' | 'complex'): DatasetPattern[] {
    const allPatterns: DatasetPattern[] = [];
    this.patterns.forEach(domainPatterns => {
      allPatterns.push(...domainPatterns.filter(p => p.complexity === complexity));
    });
    return allPatterns;
  }

  /**
   * Translate natural language query to generic dataset pattern
   */
  translateGenericQuery(
    query: string,
    domain: string,
    geography: string[],
    timeframe?: string
  ): QueryTranslationPattern | null {
    const domainPatterns = this.getPatternsForDomain(domain);
    if (domainPatterns.length === 0) {
      return null;
    }

    // Simple pattern matching based on keywords
    const queryLower = query.toLowerCase();
    let selectedPattern: DatasetPattern | null = null;

    // Education keywords
    if (domain === 'education') {
      if (queryLower.includes('school') || queryLower.includes('graduation') || queryLower.includes('performance')) {
        selectedPattern = domainPatterns.find(p => p.name === 'school_district_performance') || domainPatterns[0];
      } else if (queryLower.includes('college') || queryLower.includes('degree') || queryLower.includes('attainment')) {
        selectedPattern = domainPatterns.find(p => p.name === 'educational_attainment_demographics') || domainPatterns[1];
      } else if (queryLower.includes('funding') || queryLower.includes('equity') || queryLower.includes('spending')) {
        selectedPattern = domainPatterns.find(p => p.name === 'school_funding_equity_analysis') || domainPatterns[2];
      }
    }
    // Transportation keywords
    else if (domain === 'transportation') {
      if (queryLower.includes('commute') || queryLower.includes('drive') || queryLower.includes('work from home')) {
        selectedPattern = domainPatterns.find(p => p.name === 'commute_patterns_analysis') || domainPatterns[0];
      } else if (queryLower.includes('transit') || queryLower.includes('bus') || queryLower.includes('accessibility')) {
        selectedPattern = domainPatterns.find(p => p.name === 'public_transit_accessibility') || domainPatterns[1];
      } else if (queryLower.includes('traffic') || queryLower.includes('congestion') || queryLower.includes('delay')) {
        selectedPattern = domainPatterns.find(p => p.name === 'traffic_congestion_index') || domainPatterns[2];
      }
    }
    // Environment keywords
    else if (domain === 'environment') {
      if (queryLower.includes('air quality') || queryLower.includes('pollution') || queryLower.includes('aqi')) {
        selectedPattern = domainPatterns.find(p => p.name === 'air_quality_monitoring') || domainPatterns[0];
      } else if (queryLower.includes('climate') || queryLower.includes('resilience') || queryLower.includes('risk')) {
        selectedPattern = domainPatterns.find(p => p.name === 'climate_resilience_indicators') || domainPatterns[1];
      } else if (queryLower.includes('water') || queryLower.includes('quality') || queryLower.includes('watershed')) {
        selectedPattern = domainPatterns.find(p => p.name === 'water_quality_assessment') || domainPatterns[2];
      }
    }

    // Fallback to first pattern if no specific match
    if (!selectedPattern) {
      selectedPattern = domainPatterns[0];
    }

    // Build query translation pattern
    const sqlPattern = this.buildSQLFromPattern(selectedPattern, geography, timeframe);

    return {
      intent: selectedPattern.intent,
      entities: {
        geography,
        metrics: selectedPattern.metrics,
        timeframe: timeframe || '2023'
      },
      sqlPattern,
      parameters: {
        geography: geography.map(g => `'${g}'`).join(','),
        year: timeframe || '2023',
        domain: domain
      }
    };
  }

  /**
   * Build SQL query from pattern template
   */
  private buildSQLFromPattern(
    pattern: DatasetPattern,
    geography: string[],
    timeframe?: string
  ): string {
    let sql = pattern.sqlTemplate;

    // Replace geography placeholder
    const geographyList = geography.map(g => `'${g}'`).join(',');
    sql = sql.replace(/\{geography\}/g, geographyList);

    // Replace year/timeframe placeholder
    const year = timeframe || '2023';
    sql = sql.replace(/\{year\}/g, `'${year}'`);

    // Handle date ranges for environment patterns
    if (pattern.domain === 'environment') {
      const endDate = `${year}-12-31`;
      const startDate = `${year}-01-01`;
      sql = sql.replace(/\{end_date\}/g, `'${endDate}'`);
      sql = sql.replace(/\{start_date\}/g, `'${startDate}'`);
    }

    return sql.trim();
  }

  /**
   * Get suggested datasets configuration for a domain
   */
  getDomainConfiguration(domain: string): GenericDatasetConfig | null {
    const configurations: Record<string, GenericDatasetConfig> = {
      education: {
        domain: 'education',
        primaryDataSource: 'department_of_education',
        fallbackSources: ['census_bureau', 'state_education_agencies'],
        commonGeographies: ['county', 'school_district', 'state'],
        standardMetrics: ['graduation_rate', 'test_scores', 'per_pupil_spending', 'enrollment'],
        temporalGranularity: 'yearly'
      },
      transportation: {
        domain: 'transportation',
        primaryDataSource: 'department_of_transportation',
        fallbackSources: ['census_bureau', 'transit_agencies'],
        commonGeographies: ['metro_area', 'county', 'state'],
        standardMetrics: ['commute_time', 'transportation_mode', 'congestion_index', 'ridership'],
        temporalGranularity: 'yearly'
      },
      environment: {
        domain: 'environment',
        primaryDataSource: 'environmental_protection_agency',
        fallbackSources: ['noaa', 'usgs', 'state_environmental_agencies'],
        commonGeographies: ['county', 'watershed', 'state'],
        standardMetrics: ['air_quality_index', 'water_quality', 'climate_indicators', 'emissions'],
        temporalGranularity: 'daily'
      },
      economics: {
        domain: 'economics',
        primaryDataSource: 'bureau_of_economic_analysis',
        fallbackSources: ['bureau_of_labor_statistics', 'census_bureau'],
        commonGeographies: ['county', 'metro_area', 'state'],
        standardMetrics: ['gdp_per_capita', 'employment_rate', 'income', 'business_growth'],
        temporalGranularity: 'monthly'
      },
      housing: {
        domain: 'housing',
        primaryDataSource: 'department_of_housing',
        fallbackSources: ['census_bureau', 'real_estate_agencies'],
        commonGeographies: ['county', 'metro_area', 'state'],
        standardMetrics: ['home_values', 'rental_rates', 'affordability_index', 'housing_supply'],
        temporalGranularity: 'monthly'
      }
    };

    return configurations[domain] || null;
  }

  /**
   * Validate pattern parameters
   */
  validatePattern(pattern: DatasetPattern, parameters: any): boolean {
    // Check required parameters are present
    for (const param of pattern.parameters) {
      if (!parameters[param]) {
        console.warn(`Missing required parameter: ${param}`);
        return false;
      }
    }

    // Validate geography types
    if (parameters.geography && pattern.geographyTypes.length > 0) {
      // This would typically validate against known geography names
      console.log(`✅ Pattern validation passed for ${pattern.name}`);
    }

    return true;
  }
}

// Singleton instance
let genericPatternsInstance: GenericDatasetPatterns | null = null;

export function getGenericDatasetPatterns(): GenericDatasetPatterns {
  if (!genericPatternsInstance) {
    genericPatternsInstance = new GenericDatasetPatterns();
  }
  return genericPatternsInstance;
}

export function resetGenericDatasetPatterns(): void {
  genericPatternsInstance = null;
}