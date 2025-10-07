/**
 * Medicare Eligibility Analysis Patterns
 * Specialized SQL patterns for Medicare-related analytics
 */

import { SqlPattern } from './HealthcareSqlLibrary';
import { GeographicParams } from '../types/HealthcareAnalyticsTypes';

export class MedicareEligibilityPatterns {
  static getBasicEligibilityPattern(): SqlPattern {
    return {
      id: 'medicare_basic_eligibility',
      name: 'Medicare Basic Eligibility Analysis',
      description: 'Calculate Medicare eligibility rates and senior population demographics',
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
          population_65_plus as estimated_medicare_beneficiaries,
          ROUND(population_65_plus * 0.85) as estimated_traditional_medicare,
          ROUND(population_65_plus * 0.15) as estimated_medicare_advantage
        FROM demographics
        WHERE population_total > 0
          AND (
            (:geography_type = 'state' AND state IN (:geography_codes)) OR
            (:geography_type = 'county' AND county IN (:geography_codes)) OR
            (:geography_type = 'all')
          )
        ORDER BY medicare_eligible_rate DESC
      `,
      parameters: {
        geography_type: { type: 'string', required: true },
        geography_codes: { type: 'array', required: true }
      },
      estimatedExecutionTimeMs: 150,
      optimizationHints: ['add_limit', 'force_index_scan']
    };
  }

  static getAdvantageOpportunityPattern(): SqlPattern {
    return {
      id: 'medicare_advantage_opportunity',
      name: 'Medicare Advantage Market Opportunity Analysis',
      description: 'Analyze Medicare Advantage penetration and growth opportunities',
      category: 'medicare',
      sqlTemplate: `
        WITH medicare_advantage_metrics AS (
          SELECT
            county, state,
            population_total,
            population_65_plus,
            median_household_income,
            -- Calculate current Medicare eligibility
            ROUND(100.0 * population_65_plus / NULLIF(population_total, 0), 2) as medicare_eligible_rate,
            -- Estimate MA penetration based on market factors
            CASE
              WHEN state IN ('California', 'Florida', 'New York', 'Texas') AND median_household_income > 60000 THEN 0.50
              WHEN state IN ('California', 'Florida', 'New York', 'Texas') THEN 0.42
              WHEN median_household_income > 70000 THEN 0.38
              WHEN median_household_income > 50000 THEN 0.32
              ELSE 0.28
            END as estimated_ma_penetration_rate,
            -- National average MA penetration is about 35%
            0.35 as national_average_penetration
          FROM demographics
          WHERE population_total > 0 AND population_65_plus >= 500
        ),
        opportunity_analysis AS (
          SELECT *,
            ROUND(population_65_plus * estimated_ma_penetration_rate) as estimated_current_ma_enrollment,
            ROUND(population_65_plus * 0.50) as potential_max_ma_enrollment,
            ROUND(population_65_plus * (0.50 - estimated_ma_penetration_rate)) as growth_opportunity_count
          FROM medicare_advantage_metrics
        )
        SELECT
          county, state,
          population_65_plus as eligible_medicare_population,
          medicare_eligible_rate,
          ROUND(estimated_ma_penetration_rate * 100, 1) as current_ma_penetration_pct,
          estimated_current_ma_enrollment,
          growth_opportunity_count,
          ROUND(growth_opportunity_count / NULLIF(population_65_plus, 0) * 100, 1) as growth_opportunity_pct,
          CASE
            WHEN estimated_ma_penetration_rate < 0.25 THEN 'High Growth Market'
            WHEN estimated_ma_penetration_rate < 0.35 THEN 'Moderate Growth Market'
            WHEN estimated_ma_penetration_rate < 0.45 THEN 'Competitive Market'
            ELSE 'Mature Market'
          END as market_opportunity_category,
          CASE
            WHEN growth_opportunity_count > 5000 AND median_household_income > 50000 THEN 'Priority Target'
            WHEN growth_opportunity_count > 2000 THEN 'Secondary Target'
            ELSE 'Low Priority'
          END as target_priority,
          median_household_income,
          -- Market attractiveness score (0-100)
          ROUND(
            (growth_opportunity_count / 100 * 0.4) +
            (LEAST(median_household_income / 1000, 80) * 0.3) +
            (LEAST(population_total / 10000, 100) * 0.3)
          ) as market_attractiveness_score
        FROM opportunity_analysis
        WHERE (
          (:geography_type = 'state' AND state IN (:geography_codes)) OR
          (:geography_type = 'county' AND county IN (:geography_codes)) OR
          (:geography_type = 'all')
        )
        ORDER BY market_attractiveness_score DESC, growth_opportunity_count DESC
      `,
      parameters: {
        geography_type: { type: 'string', required: true },
        geography_codes: { type: 'array', required: true },
        year: { type: 'string', required: false }
      },
      estimatedExecutionTimeMs: 400,
      optimizationHints: ['add_limit']
    };
  }

  static getProjectionPattern(): SqlPattern {
    return {
      id: 'medicare_5year_projection',
      name: '5-Year Medicare Eligibility Projections',
      description: 'Project Medicare eligibility growth over next 5 years based on demographic trends',
      category: 'medicare',
      sqlTemplate: `
        WITH current_metrics AS (
          SELECT
            county, state,
            population_total,
            population_65_plus,
            median_household_income,
            -- Current eligibility rate
            ROUND(100.0 * population_65_plus / NULLIF(population_total, 0), 2) as current_medicare_rate
          FROM demographics
          WHERE population_total > 0
        ),
        projections AS (
          SELECT *,
            -- Assume 2.5% annual growth in 65+ population (baby boomer effect)
            -- and 1.2% annual growth in total population
            ROUND(population_65_plus * POWER(1.025, 5)) as projected_65_plus_2029,
            ROUND(population_total * POWER(1.012, 5)) as projected_total_2029,
            -- Calculate year-by-year projections
            ROUND(population_65_plus * POWER(1.025, 1)) as projected_65_plus_2025,
            ROUND(population_65_plus * POWER(1.025, 2)) as projected_65_plus_2026,
            ROUND(population_65_plus * POWER(1.025, 3)) as projected_65_plus_2027,
            ROUND(population_65_plus * POWER(1.025, 4)) as projected_65_plus_2028
          FROM current_metrics
        )
        SELECT
          county, state,
          population_total as current_population,
          population_65_plus as current_seniors,
          current_medicare_rate,
          projected_65_plus_2025,
          projected_65_plus_2026,
          projected_65_plus_2027,
          projected_65_plus_2028,
          projected_65_plus_2029,
          ROUND(100.0 * projected_65_plus_2029 / NULLIF(projected_total_2029, 0), 2) as projected_medicare_rate_2029,
          projected_65_plus_2029 - population_65_plus as net_growth_5_years,
          ROUND((projected_65_plus_2029 - population_65_plus) / 5.0) as avg_annual_growth,
          ROUND(((projected_65_plus_2029 / NULLIF(population_65_plus, 0)) - 1) * 100, 1) as total_growth_pct_5_years,
          CASE
            WHEN ((projected_65_plus_2029 / NULLIF(population_65_plus, 0)) - 1) * 100 > 15 THEN 'High Growth Market'
            WHEN ((projected_65_plus_2029 / NULLIF(population_65_plus, 0)) - 1) * 100 > 10 THEN 'Moderate Growth Market'
            ELSE 'Stable Market'
          END as growth_category,
          median_household_income
        FROM projections
        WHERE (
          (:geography_type = 'state' AND state IN (:geography_codes)) OR
          (:geography_type = 'county' AND county IN (:geography_codes)) OR
          (:geography_type = 'all')
        )
        ORDER BY total_growth_pct_5_years DESC, net_growth_5_years DESC
      `,
      parameters: {
        geography_type: { type: 'string', required: true },
        geography_codes: { type: 'array', required: true }
      },
      estimatedExecutionTimeMs: 300,
      optimizationHints: ['add_limit']
    };
  }

  static getDualEligiblePattern(): SqlPattern {
    return {
      id: 'medicare_dual_eligible_analysis',
      name: 'Medicare-Medicaid Dual Eligible Analysis',
      description: 'Analyze potential dual eligible population based on income and age demographics',
      category: 'medicare',
      sqlTemplate: `
        WITH dual_eligible_analysis AS (
          SELECT
            county, state,
            population_total,
            population_65_plus,
            median_household_income,
            -- Estimate dual eligible population
            -- Dual eligibles are typically seniors with income < 135% of Federal Poverty Level (~$18,000)
            CASE
              WHEN median_household_income < 25000 THEN population_65_plus * 0.35
              WHEN median_household_income < 35000 THEN population_65_plus * 0.25
              WHEN median_household_income < 45000 THEN population_65_plus * 0.15
              ELSE population_65_plus * 0.08
            END as estimated_dual_eligible_population,
            -- Calculate poverty indicators
            CASE
              WHEN median_household_income < 30000 THEN 'High Poverty'
              WHEN median_household_income < 50000 THEN 'Moderate Poverty'
              ELSE 'Low Poverty'
            END as poverty_category
          FROM demographics
          WHERE population_total > 0 AND population_65_plus > 100
        )
        SELECT
          county, state,
          population_65_plus as total_medicare_eligible,
          ROUND(estimated_dual_eligible_population) as estimated_dual_eligible,
          ROUND(100.0 * estimated_dual_eligible_population / NULLIF(population_65_plus, 0), 1) as dual_eligible_rate_pct,
          poverty_category,
          median_household_income,
          -- Special Needs Plan opportunity
          ROUND(estimated_dual_eligible_population * 0.60) as snp_opportunity_count,
          CASE
            WHEN estimated_dual_eligible_population > 1000 AND median_household_income < 35000 THEN 'High SNP Opportunity'
            WHEN estimated_dual_eligible_population > 500 THEN 'Moderate SNP Opportunity'
            ELSE 'Low SNP Opportunity'
          END as snp_opportunity_category,
          -- Care coordination needs
          CASE
            WHEN estimated_dual_eligible_population > 2000 THEN 'High Care Coordination Need'
            WHEN estimated_dual_eligible_population > 1000 THEN 'Moderate Care Coordination Need'
            ELSE 'Low Care Coordination Need'
          END as care_coordination_need,
          -- Social determinants risk score
          ROUND(
            CASE
              WHEN median_household_income < 25000 THEN 4
              WHEN median_household_income < 35000 THEN 3
              WHEN median_household_income < 50000 THEN 2
              ELSE 1
            END +
            CASE
              WHEN population_total < 50000 THEN 2  -- Rural risk factor
              ELSE 1
            END
          ) as social_determinants_risk_score
        FROM dual_eligible_analysis
        WHERE (
          (:geography_type = 'state' AND state IN (:geography_codes)) OR
          (:geography_type = 'county' AND county IN (:geography_codes)) OR
          (:geography_type = 'all')
        )
        ORDER BY estimated_dual_eligible DESC, social_determinants_risk_score DESC
      `,
      parameters: {
        geography_type: { type: 'string', required: true },
        geography_codes: { type: 'array', required: true }
      },
      estimatedExecutionTimeMs: 250,
      optimizationHints: ['add_limit']
    };
  }
}

export function getMedicarePatterns(): SqlPattern[] {
  return [
    MedicareEligibilityPatterns.getBasicEligibilityPattern(),
    MedicareEligibilityPatterns.getAdvantageOpportunityPattern(),
    MedicareEligibilityPatterns.getProjectionPattern(),
    MedicareEligibilityPatterns.getDualEligiblePattern()
  ];
}