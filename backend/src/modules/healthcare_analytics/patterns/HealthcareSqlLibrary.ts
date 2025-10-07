/**
 * Healthcare SQL Pattern Library
 * Optimized SQL patterns for healthcare analytics
 */

import {
  PatternDefinition,
  GeographicParams,
  RiskFactorParams,
  FacilityParams
} from '../types/HealthcareAnalyticsTypes';
import { getMedicarePatterns } from './MedicareEligibilityPatterns';
import { getPopulationHealthPatterns } from './PopulationHealthPatterns';
import { getFacilityAdequacyPatterns } from './FacilityAdequacyPatterns';

export interface SqlPattern {
  id: string;
  name: string;
  description: string;
  category: 'medicare' | 'population_health' | 'facility_adequacy' | 'demographics';
  sqlTemplate: string;
  parameters: Record<string, any>;
  estimatedExecutionTimeMs: number;
  optimizationHints: string[];
}

export class HealthcareSqlLibrary {
  private patterns: Map<string, SqlPattern> = new Map();

  constructor() {
    console.log('📚 Initializing Healthcare SQL Pattern Library');
    this.initializePatterns();
    this.loadSpecializedPatterns();
  }

  getPattern(patternId: string): SqlPattern | undefined {
    return this.patterns.get(patternId);
  }

  listPatterns(): SqlPattern[] {
    return Array.from(this.patterns.values());
  }

  listPatternsByCategory(category: string): SqlPattern[] {
    return Array.from(this.patterns.values()).filter(p => p.category === category);
  }

  generateOptimizedSql(patternId: string, parameters: any): string {
    const pattern = this.patterns.get(patternId);
    if (!pattern) {
      throw new Error(`Pattern not found: ${patternId}`);
    }

    let sql = pattern.sqlTemplate;

    // Replace parameters in SQL template
    Object.entries(parameters).forEach(([key, value]) => {
      const placeholder = `:${key}`;

      if (Array.isArray(value)) {
        // Handle array parameters for IN clauses
        const arrayValues = value.map(v => `'${v.replace(/'/g, "''")}'`).join(', ');
        sql = sql.replace(new RegExp(placeholder, 'g'), arrayValues);
      } else {
        // Handle scalar parameters
        const escapedValue = typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` : value;
        sql = sql.replace(new RegExp(placeholder, 'g'), String(escapedValue));
      }
    });

    return this.applyOptimizations(sql, pattern.optimizationHints);
  }

  private applyOptimizations(sql: string, hints: string[]): string {
    let optimizedSql = sql;

    // Apply performance optimizations based on hints
    hints.forEach(hint => {
      switch (hint) {
        case 'add_limit':
          if (!optimizedSql.toLowerCase().includes('limit')) {
            optimizedSql += ' LIMIT 1000';
          }
          break;

        case 'force_index_scan':
          // Add hints for index usage
          optimizedSql = optimizedSql.replace(
            'FROM demographics',
            'FROM demographics /*+ INDEX(idx_demographics_geography) */'
          );
          break;

        case 'optimize_joins':
          // Optimize join order for better performance
          break;
      }
    });

    return optimizedSql;
  }

  private initializePatterns(): void {
    // Medicare Eligibility Patterns
    this.patterns.set('medicare_basic_eligibility', {
      id: 'medicare_basic_eligibility',
      name: 'Basic Medicare Eligibility Analysis',
      description: 'Calculate Medicare eligibility rates by county with senior population categorization',
      category: 'medicare',
      sqlTemplate: `
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
          END as senior_population_category,
          population_65_plus as estimated_medicare_beneficiaries
        FROM demographics
        WHERE population_total > 0
          AND (:geography_type = 'state' AND state IN (:geography_codes) OR :geography_type = 'county')
        ORDER BY medicare_eligible_rate DESC
      `,
      parameters: {
        geography_type: { type: 'string', required: true },
        geography_codes: { type: 'array', required: true }
      },
      estimatedExecutionTimeMs: 150,
      optimizationHints: ['add_limit', 'force_index_scan']
    });

    this.patterns.set('medicare_advantage_opportunity', {
      id: 'medicare_advantage_opportunity',
      name: 'Medicare Advantage Market Opportunity',
      description: 'Analyze Medicare Advantage penetration opportunities with market gap analysis',
      category: 'medicare',
      sqlTemplate: `
        WITH medicare_metrics AS (
          SELECT
            county, state,
            population_total,
            population_65_plus,
            median_household_income,
            ROUND(100.0 * population_65_plus / NULLIF(population_total, 0), 2) as medicare_eligible_rate,
            -- Estimate MA penetration based on income and geography
            CASE
              WHEN median_household_income > 60000 AND state IN ('California', 'Florida', 'New York') THEN 0.45
              WHEN median_household_income > 50000 THEN 0.35
              ELSE 0.25
            END as estimated_ma_penetration,
            population_65_plus * 0.35 as current_ma_estimate
          FROM demographics
          WHERE population_total > 0 AND population_65_plus > 1000
        )
        SELECT
          county, state,
          population_65_plus as eligible_population,
          medicare_eligible_rate,
          estimated_ma_penetration * 100 as ma_penetration_pct,
          ROUND(current_ma_estimate) as estimated_current_ma_enrollment,
          ROUND(population_65_plus * (0.50 - estimated_ma_penetration)) as growth_opportunity,
          CASE
            WHEN estimated_ma_penetration < 0.30 THEN 'High Growth Potential'
            WHEN estimated_ma_penetration < 0.40 THEN 'Moderate Growth Potential'
            ELSE 'Saturated Market'
          END as opportunity_rating,
          median_household_income
        FROM medicare_metrics
        WHERE (:geography_type = 'state' AND state IN (:geography_codes) OR :geography_type = 'county')
        ORDER BY growth_opportunity DESC
      `,
      parameters: {
        geography_type: { type: 'string', required: true },
        geography_codes: { type: 'array', required: true }
      },
      estimatedExecutionTimeMs: 300,
      optimizationHints: ['add_limit']
    });

    // Population Health Risk Patterns
    this.patterns.set('population_health_basic_risk', {
      id: 'population_health_basic_risk',
      name: 'Basic Population Health Risk Assessment',
      description: 'Multi-factor risk scoring based on demographics and socioeconomic indicators',
      category: 'population_health',
      sqlTemplate: `
        WITH risk_factors AS (
          SELECT
            county, state,
            population_total,
            population_65_plus,
            median_household_income,
            -- Income risk scoring
            CASE
              WHEN median_household_income < 35000 THEN 4
              WHEN median_household_income < 45000 THEN 3
              WHEN median_household_income < 65000 THEN 2
              ELSE 1
            END as income_risk_score,
            -- Age risk scoring (higher senior population = higher risk)
            CASE
              WHEN population_65_plus / NULLIF(population_total, 0) > 0.25 THEN 3
              WHEN population_65_plus / NULLIF(population_total, 0) > 0.18 THEN 2
              ELSE 1
            END as age_risk_score,
            -- Population density risk (rural areas often higher risk)
            CASE
              WHEN population_total < 25000 THEN 2
              ELSE 1
            END as density_risk_score
          FROM demographics
          WHERE population_total > 0
        ),
        risk_analysis AS (
          SELECT *,
            (income_risk_score + age_risk_score + density_risk_score) as composite_risk_score
          FROM risk_factors
        )
        SELECT
          county, state,
          population_total,
          median_household_income,
          ROUND(100.0 * population_65_plus / population_total, 1) as senior_population_pct,
          income_risk_score,
          age_risk_score,
          density_risk_score,
          composite_risk_score,
          CASE
            WHEN composite_risk_score >= 8 THEN 'Very High Risk'
            WHEN composite_risk_score >= 6 THEN 'High Risk'
            WHEN composite_risk_score >= 4 THEN 'Moderate Risk'
            ELSE 'Low Risk'
          END as risk_category,
          -- Priority score for intervention targeting
          composite_risk_score * population_total / 10000 as intervention_priority_score
        FROM risk_analysis
        WHERE (:geography_type = 'state' AND state IN (:geography_codes) OR :geography_type = 'county')
        ORDER BY composite_risk_score DESC, population_total DESC
      `,
      parameters: {
        geography_type: { type: 'string', required: true },
        geography_codes: { type: 'array', required: true },
        risk_factors: { type: 'array', required: false }
      },
      estimatedExecutionTimeMs: 250,
      optimizationHints: ['add_limit']
    });

    // Healthcare Facility Adequacy Patterns
    this.patterns.set('facility_adequacy_basic', {
      id: 'facility_adequacy_basic',
      name: 'Basic Healthcare Facility Adequacy',
      description: 'Assess healthcare facility adequacy using population-based ratios',
      category: 'facility_adequacy',
      sqlTemplate: `
        WITH facility_metrics AS (
          SELECT
            county, state,
            population_total,
            population_65_plus,
            median_household_income,
            -- Estimate facility needs based on population
            ROUND(population_total / 8000.0) as estimated_needed_facilities,
            -- Current facility estimate (this would come from actual facility data)
            ROUND(population_total / 12000.0) as estimated_current_facilities,
            -- Calculate ratios
            ROUND(population_total / 10000.0, 2) as facilities_per_10k_estimate
          FROM demographics
          WHERE population_total > 0
        )
        SELECT
          county, state,
          population_total,
          population_65_plus,
          estimated_current_facilities as facilities_count,
          facilities_per_10k_estimate as facilities_per_10k,
          estimated_needed_facilities - estimated_current_facilities as facility_gap,
          CASE
            WHEN facilities_per_10k_estimate < 0.8 THEN 'Severely Underserved'
            WHEN facilities_per_10k_estimate < 1.2 THEN 'Underserved'
            WHEN facilities_per_10k_estimate > 2.0 THEN 'Well Served'
            ELSE 'Adequately Served'
          END as adequacy_rating,
          -- Priority scoring for facility development
          CASE
            WHEN facilities_per_10k_estimate < 0.8 THEN population_total / 1000
            WHEN facilities_per_10k_estimate < 1.2 THEN population_total / 2000
            ELSE 0
          END as development_priority_score,
          median_household_income
        FROM facility_metrics
        WHERE (:geography_type = 'state' AND state IN (:geography_codes) OR :geography_type = 'county')
        ORDER BY development_priority_score DESC, facilities_per_10k ASC
      `,
      parameters: {
        geography_type: { type: 'string', required: true },
        geography_codes: { type: 'array', required: true },
        facility_type: { type: 'string', required: false }
      },
      estimatedExecutionTimeMs: 200,
      optimizationHints: ['add_limit']
    });

    // Advanced Composite Patterns
    this.patterns.set('healthcare_dashboard_composite', {
      id: 'healthcare_dashboard_composite',
      name: 'Healthcare Dashboard Composite View',
      description: 'Comprehensive healthcare metrics combining Medicare, risk, and facility data',
      category: 'demographics',
      sqlTemplate: `
        WITH comprehensive_metrics AS (
          SELECT
            county, state,
            population_total,
            population_65_plus,
            median_household_income,
            -- Medicare metrics
            ROUND(100.0 * population_65_plus / NULLIF(population_total, 0), 2) as medicare_eligible_rate,
            -- Risk metrics
            CASE
              WHEN median_household_income < 40000 THEN 3
              WHEN median_household_income < 60000 THEN 2
              ELSE 1
            END as income_risk_score,
            -- Facility metrics
            ROUND(population_total / 10000.0, 2) as facilities_per_10k_estimate,
            -- Calculate composite scores
            ROUND((
              (CASE WHEN median_household_income < 40000 THEN 3 ELSE 1 END) +
              (CASE WHEN population_65_plus / NULLIF(population_total, 0) > 0.20 THEN 2 ELSE 1 END) +
              (CASE WHEN population_total / 10000.0 < 1.0 THEN 2 ELSE 1 END)
            ) / 3.0, 1) as composite_health_index
          FROM demographics
          WHERE population_total > 0
        )
        SELECT
          county, state,
          population_total,
          population_65_plus,
          medicare_eligible_rate,
          income_risk_score,
          facilities_per_10k_estimate,
          composite_health_index,
          CASE
            WHEN composite_health_index >= 2.5 THEN 'High Need'
            WHEN composite_health_index >= 2.0 THEN 'Moderate Need'
            ELSE 'Low Need'
          END as overall_need_category,
          median_household_income
        FROM comprehensive_metrics
        WHERE (:geography_type = 'state' AND state IN (:geography_codes) OR :geography_type = 'county')
        ORDER BY composite_health_index DESC
      `,
      parameters: {
        geography_type: { type: 'string', required: true },
        geography_codes: { type: 'array', required: true }
      },
      estimatedExecutionTimeMs: 350,
      optimizationHints: ['add_limit', 'force_index_scan']
    });

    console.log(`✅ Initialized ${this.patterns.size} core healthcare SQL patterns`);
  }

  private loadSpecializedPatterns(): void {
    console.log('📋 Loading specialized healthcare patterns...');

    // Load Medicare patterns
    const medicarePatterns = getMedicarePatterns();
    medicarePatterns.forEach(pattern => {
      this.patterns.set(pattern.id, pattern);
    });

    // Load Population Health patterns
    const populationHealthPatterns = getPopulationHealthPatterns();
    populationHealthPatterns.forEach(pattern => {
      this.patterns.set(pattern.id, pattern);
    });

    // Load Facility Adequacy patterns
    const facilityPatterns = getFacilityAdequacyPatterns();
    facilityPatterns.forEach(pattern => {
      this.patterns.set(pattern.id, pattern);
    });

    // Add comprehensive composite pattern
    this.addCompositeHealthcareIndicatorPattern();

    console.log(`✅ Loaded ${this.patterns.size} total healthcare SQL patterns including specialized patterns`);
  }

  private addCompositeHealthcareIndicatorPattern(): void {
    this.patterns.set('healthcare_comprehensive_composite', {
      id: 'healthcare_comprehensive_composite',
      name: 'Comprehensive Healthcare Indicator Composite Analysis',
      description: 'Multi-dimensional healthcare analysis combining Medicare, population health, and facility adequacy metrics',
      category: 'demographics',
      sqlTemplate: `
        WITH medicare_metrics AS (
          SELECT
            county, state,
            population_total,
            population_65_plus,
            median_household_income,
            ROUND(100.0 * population_65_plus / NULLIF(population_total, 0), 2) as medicare_eligible_rate,
            population_65_plus * 0.35 as estimated_ma_opportunity,
            CASE
              WHEN population_65_plus / NULLIF(population_total, 0) > 0.20 THEN 4
              WHEN population_65_plus / NULLIF(population_total, 0) > 0.15 THEN 3
              WHEN population_65_plus / NULLIF(population_total, 0) > 0.12 THEN 2
              ELSE 1
            END as medicare_demand_score
          FROM demographics
          WHERE population_total > 0
        ),
        health_risk_metrics AS (
          SELECT
            county, state,
            -- Income-based health risk
            CASE
              WHEN median_household_income < 30000 THEN 5
              WHEN median_household_income < 45000 THEN 4
              WHEN median_household_income < 60000 THEN 3
              WHEN median_household_income < 80000 THEN 2
              ELSE 1
            END as income_health_risk_score,
            -- Age-based health risk
            CASE
              WHEN population_65_plus / NULLIF(population_total, 0) > 0.25 THEN 4
              WHEN population_65_plus / NULLIF(population_total, 0) > 0.20 THEN 3
              WHEN population_65_plus / NULLIF(population_total, 0) > 0.15 THEN 2
              ELSE 1
            END as age_health_risk_score,
            -- Population density health risk (both very rural and very urban have challenges)
            CASE
              WHEN population_total < 15000 THEN 3  -- Rural access challenges
              WHEN population_total > 500000 THEN 2  -- Urban density challenges
              ELSE 1  -- Optimal population size
            END as density_health_risk_score,
            -- Estimated chronic disease burden
            ROUND(population_65_plus * 0.45) as estimated_chronic_disease_population
          FROM demographics
          WHERE population_total > 0
        ),
        facility_adequacy_metrics AS (
          SELECT
            county, state,
            -- Primary care adequacy
            ROUND(population_total / 3500.0, 2) as needed_primary_care_ratio,
            ROUND(population_total / 5000.0, 2) as estimated_current_primary_care_ratio,
            -- Hospital adequacy
            CASE
              WHEN population_total < 50000 THEN ROUND(population_total / 8000.0, 2)
              ELSE ROUND(population_total / 12000.0, 2)
            END as needed_hospital_ratio,
            ROUND(population_total / 15000.0, 2) as estimated_current_hospital_ratio,
            -- Specialist adequacy
            ROUND(population_total / 15000.0, 2) as needed_specialist_ratio,
            ROUND(population_total / 25000.0, 2) as estimated_current_specialist_ratio
          FROM demographics
          WHERE population_total > 0
        ),
        composite_calculation AS (
          SELECT
            mm.county, mm.state,
            mm.population_total,
            mm.population_65_plus,
            mm.median_household_income,
            mm.medicare_eligible_rate,
            mm.medicare_demand_score,
            mm.estimated_ma_opportunity,
            -- Health risk composite
            hrm.income_health_risk_score,
            hrm.age_health_risk_score,
            hrm.density_health_risk_score,
            (hrm.income_health_risk_score + hrm.age_health_risk_score + hrm.density_health_risk_score) as composite_health_risk_score,
            hrm.estimated_chronic_disease_population,
            -- Facility adequacy composite
            fam.needed_primary_care_ratio,
            fam.estimated_current_primary_care_ratio,
            fam.needed_primary_care_ratio - fam.estimated_current_primary_care_ratio as primary_care_gap,
            fam.needed_hospital_ratio,
            fam.estimated_current_hospital_ratio,
            fam.needed_hospital_ratio - fam.estimated_current_hospital_ratio as hospital_gap,
            fam.needed_specialist_ratio,
            fam.estimated_current_specialist_ratio,
            fam.needed_specialist_ratio - fam.estimated_current_specialist_ratio as specialist_gap,
            -- Calculate facility adequacy score (higher is better)
            ROUND(
              GREATEST(0, 2 - (fam.needed_primary_care_ratio - fam.estimated_current_primary_care_ratio)) * 0.4 +
              GREATEST(0, 2 - (fam.needed_hospital_ratio - fam.estimated_current_hospital_ratio)) * 0.3 +
              GREATEST(0, 2 - (fam.needed_specialist_ratio - fam.estimated_current_specialist_ratio)) * 0.3,
              2
            ) as facility_adequacy_score
          FROM medicare_metrics mm
          LEFT JOIN health_risk_metrics hrm ON mm.county = hrm.county AND mm.state = hrm.state
          LEFT JOIN facility_adequacy_metrics fam ON mm.county = fam.county AND mm.state = fam.state
        )
        SELECT
          county, state,
          population_total,
          population_65_plus,
          median_household_income,
          medicare_eligible_rate,
          -- Medicare metrics
          medicare_demand_score,
          ROUND(estimated_ma_opportunity) as medicare_advantage_opportunity,
          -- Health risk metrics
          composite_health_risk_score,
          CASE
            WHEN composite_health_risk_score >= 12 THEN 'Very High Health Risk'
            WHEN composite_health_risk_score >= 9 THEN 'High Health Risk'
            WHEN composite_health_risk_score >= 6 THEN 'Moderate Health Risk'
            ELSE 'Low Health Risk'
          END as health_risk_category,
          ROUND(estimated_chronic_disease_population) as estimated_chronic_disease_cases,
          -- Facility adequacy metrics
          facility_adequacy_score,
          ROUND(primary_care_gap, 2) as primary_care_provider_gap,
          ROUND(hospital_gap, 2) as hospital_facility_gap,
          ROUND(specialist_gap, 2) as specialist_provider_gap,
          CASE
            WHEN facility_adequacy_score >= 1.5 THEN 'Well Served'
            WHEN facility_adequacy_score >= 1.0 THEN 'Adequately Served'
            WHEN facility_adequacy_score >= 0.7 THEN 'Underserved'
            ELSE 'Significantly Underserved'
          END as facility_adequacy_rating,
          -- Comprehensive Healthcare Index (0-10 scale, 10 being optimal)
          ROUND(
            -- Medicare opportunity (20% weight)
            (medicare_demand_score / 4.0) * 2.0 +
            -- Health risk (30% weight) - inverted so lower risk = higher score
            ((13 - composite_health_risk_score) / 12.0) * 3.0 +
            -- Facility adequacy (50% weight)
            (facility_adequacy_score / 2.0) * 5.0,
            1
          ) as comprehensive_healthcare_index,
          -- Overall healthcare opportunity category
          CASE
            WHEN ROUND(
              (medicare_demand_score / 4.0) * 2.0 +
              ((13 - composite_health_risk_score) / 12.0) * 3.0 +
              (facility_adequacy_score / 2.0) * 5.0,
              1
            ) >= 8.0 THEN 'Excellent Healthcare Market'
            WHEN ROUND(
              (medicare_demand_score / 4.0) * 2.0 +
              ((13 - composite_health_risk_score) / 12.0) * 3.0 +
              (facility_adequacy_score / 2.0) * 5.0,
              1
            ) >= 6.5 THEN 'Strong Healthcare Market'
            WHEN ROUND(
              (medicare_demand_score / 4.0) * 2.0 +
              ((13 - composite_health_risk_score) / 12.0) * 3.0 +
              (facility_adequacy_score / 2.0) * 5.0,
              1
            ) >= 5.0 THEN 'Moderate Healthcare Market'
            WHEN ROUND(
              (medicare_demand_score / 4.0) * 2.0 +
              ((13 - composite_health_risk_score) / 12.0) * 3.0 +
              (facility_adequacy_score / 2.0) * 5.0,
              1
            ) >= 3.5 THEN 'Challenging Healthcare Market'
            ELSE 'High-Need Healthcare Market'
          END as healthcare_market_category,
          -- Investment priority score
          ROUND(
            composite_health_risk_score * 0.3 +  -- Higher risk = higher priority
            (4 - facility_adequacy_score) * 0.4 + -- Lower adequacy = higher priority
            (medicare_demand_score) * 0.2 +      -- Higher demand = higher opportunity
            LOG(population_total + 1) / 10 * 0.1  -- Population size factor
          ) as healthcare_investment_priority_score,
          -- Specific recommendations
          CASE
            WHEN primary_care_gap > 0.5 AND composite_health_risk_score >= 9 THEN 'Priority: Primary Care Expansion'
            WHEN hospital_gap > 0.3 AND medicare_demand_score >= 3 THEN 'Priority: Hospital Services Development'
            WHEN specialist_gap > 0.4 AND estimated_chronic_disease_population > 1000 THEN 'Priority: Specialty Care Access'
            WHEN composite_health_risk_score >= 10 THEN 'Priority: Community Health Programs'
            WHEN medicare_demand_score >= 3 AND facility_adequacy_score >= 1.2 THEN 'Opportunity: Medicare Advantage Growth'
            ELSE 'Standard: Maintain Current Service Levels'
          END as primary_healthcare_recommendation
        FROM composite_calculation
        WHERE (
          (:geography_type = 'state' AND state IN (:geography_codes)) OR
          (:geography_type = 'county' AND county IN (:geography_codes)) OR
          (:geography_type = 'all')
        )
        ORDER BY comprehensive_healthcare_index DESC, healthcare_investment_priority_score DESC
      `,
      parameters: {
        geography_type: { type: 'string', required: true },
        geography_codes: { type: 'array', required: true },
        focus_area: { type: 'string', required: false }
      },
      estimatedExecutionTimeMs: 600,
      optimizationHints: ['add_limit', 'force_index_scan']
    });
  }

  validateParameters(patternId: string, parameters: any): { isValid: boolean; errors: string[] } {
    const pattern = this.patterns.get(patternId);
    if (!pattern) {
      return { isValid: false, errors: [`Pattern not found: ${patternId}`] };
    }

    const errors: string[] = [];

    Object.entries(pattern.parameters).forEach(([paramName, paramDef]: [string, any]) => {
      if (paramDef.required && !parameters[paramName]) {
        errors.push(`Required parameter missing: ${paramName}`);
      }

      if (paramDef.type === 'array' && parameters[paramName] && !Array.isArray(parameters[paramName])) {
        errors.push(`Parameter ${paramName} must be an array`);
      }
    });

    return { isValid: errors.length === 0, errors };
  }

  getExecutionEstimate(patternId: string, parameters: any): number {
    const pattern = this.patterns.get(patternId);
    if (!pattern) {
      return 2000; // Default max time
    }

    let estimate = pattern.estimatedExecutionTimeMs;

    // Adjust estimate based on parameter complexity
    if (parameters.geography_codes && Array.isArray(parameters.geography_codes)) {
      estimate += parameters.geography_codes.length * 10; // Add time per geography
    }

    return Math.min(estimate, 2000); // Cap at 2 seconds
  }
}

// Singleton instance
let sqlLibraryInstance: HealthcareSqlLibrary | null = null;

export function getHealthcareSqlLibrary(): HealthcareSqlLibrary {
  if (!sqlLibraryInstance) {
    sqlLibraryInstance = new HealthcareSqlLibrary();
  }
  return sqlLibraryInstance;
}