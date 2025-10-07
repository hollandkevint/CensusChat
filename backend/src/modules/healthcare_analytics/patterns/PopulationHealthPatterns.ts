/**
 * Population Health Risk Patterns
 * Specialized SQL patterns for population health risk stratification
 */

import { SqlPattern } from './HealthcareSqlLibrary';
import { RiskFactorParams } from '../types/HealthcareAnalyticsTypes';

export class PopulationHealthPatterns {
  static getBasicRiskAssessmentPattern(): SqlPattern {
    return {
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
            -- Income risk scoring (higher risk for lower income)
            CASE
              WHEN median_household_income < 30000 THEN 5
              WHEN median_household_income < 40000 THEN 4
              WHEN median_household_income < 50000 THEN 3
              WHEN median_household_income < 70000 THEN 2
              ELSE 1
            END as income_risk_score,
            -- Age risk scoring (higher senior population = higher healthcare risk)
            CASE
              WHEN population_65_plus / NULLIF(population_total, 0) > 0.25 THEN 4
              WHEN population_65_plus / NULLIF(population_total, 0) > 0.20 THEN 3
              WHEN population_65_plus / NULLIF(population_total, 0) > 0.15 THEN 2
              ELSE 1
            END as age_risk_score,
            -- Population density risk (rural areas often have healthcare access challenges)
            CASE
              WHEN population_total < 15000 THEN 3  -- Very rural
              WHEN population_total < 50000 THEN 2  -- Rural
              WHEN population_total > 500000 THEN 2  -- Very urban (different challenges)
              ELSE 1  -- Suburban/moderate urban
            END as density_risk_score,
            -- Calculate insurance risk proxy based on income
            CASE
              WHEN median_household_income < 25000 THEN 4  -- High uninsured risk
              WHEN median_household_income < 45000 THEN 3
              WHEN median_household_income < 75000 THEN 2
              ELSE 1
            END as insurance_risk_score
          FROM demographics
          WHERE population_total > 0
        ),
        risk_analysis AS (
          SELECT *,
            (income_risk_score + age_risk_score + density_risk_score + insurance_risk_score) as composite_risk_score,
            -- Calculate additional health indicators
            ROUND(population_65_plus * 0.15) as estimated_diabetes_cases,
            ROUND(population_65_plus * 0.08) as estimated_heart_disease_cases,
            ROUND(population_total * 0.12) as estimated_mental_health_needs
          FROM risk_factors
        )
        SELECT
          county, state,
          population_total,
          population_65_plus,
          ROUND(100.0 * population_65_plus / NULLIF(population_total, 0), 1) as senior_population_pct,
          median_household_income,
          income_risk_score,
          age_risk_score,
          density_risk_score,
          insurance_risk_score,
          composite_risk_score,
          CASE
            WHEN composite_risk_score >= 15 THEN 'Critical Risk'
            WHEN composite_risk_score >= 12 THEN 'Very High Risk'
            WHEN composite_risk_score >= 9 THEN 'High Risk'
            WHEN composite_risk_score >= 6 THEN 'Moderate Risk'
            ELSE 'Low Risk'
          END as risk_category,
          estimated_diabetes_cases,
          estimated_heart_disease_cases,
          estimated_mental_health_needs,
          -- Priority score for intervention targeting (population size weighted)
          ROUND(composite_risk_score * LOG(population_total + 1) / 10) as intervention_priority_score,
          -- Health equity score (lower income areas get higher equity priority)
          CASE
            WHEN median_household_income < 35000 AND composite_risk_score >= 9 THEN 'High Equity Priority'
            WHEN median_household_income < 50000 AND composite_risk_score >= 6 THEN 'Moderate Equity Priority'
            ELSE 'Standard Priority'
          END as health_equity_priority
        FROM risk_analysis
        WHERE (
          (:geography_type = 'state' AND state IN (:geography_codes)) OR
          (:geography_type = 'county' AND county IN (:geography_codes)) OR
          (:geography_type = 'all')
        )
        ORDER BY composite_risk_score DESC, intervention_priority_score DESC
      `,
      parameters: {
        geography_type: { type: 'string', required: true },
        geography_codes: { type: 'array', required: true },
        risk_factors: { type: 'array', required: false }
      },
      estimatedExecutionTimeMs: 350,
      optimizationHints: ['add_limit', 'force_index_scan']
    };
  }

  static getChronicDiseaseRiskPattern(): SqlPattern {
    return {
      id: 'population_health_chronic_disease_risk',
      name: 'Chronic Disease Risk Stratification',
      description: 'Estimate chronic disease prevalence and risk factors by demographics',
      category: 'population_health',
      sqlTemplate: `
        WITH chronic_disease_analysis AS (
          SELECT
            county, state,
            population_total,
            population_65_plus,
            median_household_income,
            -- Age-adjusted disease risk calculations
            population_65_plus as high_risk_age_population,
            ROUND(population_total * 0.45) as population_45_plus_estimate,
            -- Diabetes risk estimation (higher in lower income, older populations)
            CASE
              WHEN median_household_income < 35000 THEN population_65_plus * 0.28
              WHEN median_household_income < 50000 THEN population_65_plus * 0.22
              WHEN median_household_income < 75000 THEN population_65_plus * 0.18
              ELSE population_65_plus * 0.15
            END as estimated_diabetes_high_risk,
            -- Heart disease risk estimation
            CASE
              WHEN median_household_income < 40000 THEN population_65_plus * 0.25
              WHEN median_household_income < 60000 THEN population_65_plus * 0.20
              ELSE population_65_plus * 0.16
            END as estimated_heart_disease_risk,
            -- Hypertension risk estimation (very common in seniors)
            population_65_plus * 0.58 as estimated_hypertension_cases,
            -- COPD risk estimation (varies by region and income)
            CASE
              WHEN median_household_income < 30000 THEN population_65_plus * 0.15
              WHEN median_household_income < 50000 THEN population_65_plus * 0.12
              ELSE population_65_plus * 0.08
            END as estimated_copd_cases
          FROM demographics
          WHERE population_total > 0 AND population_65_plus >= 100
        ),
        disease_burden_analysis AS (
          SELECT *,
            (estimated_diabetes_high_risk + estimated_heart_disease_risk + estimated_hypertension_cases + estimated_copd_cases) as total_chronic_disease_burden,
            ROUND(estimated_diabetes_high_risk + estimated_heart_disease_risk + estimated_hypertension_cases + estimated_copd_cases) / NULLIF(population_65_plus, 0) * 100 as chronic_disease_rate_pct
          FROM chronic_disease_analysis
        )
        SELECT
          county, state,
          population_total,
          population_65_plus,
          median_household_income,
          ROUND(estimated_diabetes_high_risk) as diabetes_high_risk_count,
          ROUND(estimated_heart_disease_risk) as heart_disease_risk_count,
          ROUND(estimated_hypertension_cases) as hypertension_est_count,
          ROUND(estimated_copd_cases) as copd_est_count,
          ROUND(total_chronic_disease_burden) as total_chronic_burden,
          ROUND(chronic_disease_rate_pct, 1) as chronic_disease_rate_pct,
          CASE
            WHEN chronic_disease_rate_pct > 180 THEN 'Very High Burden'
            WHEN chronic_disease_rate_pct > 150 THEN 'High Burden'
            WHEN chronic_disease_rate_pct > 120 THEN 'Moderate Burden'
            ELSE 'Low Burden'
          END as disease_burden_category,
          -- Care management priority
          CASE
            WHEN total_chronic_disease_burden > 5000 AND median_household_income < 40000 THEN 'Critical Care Management Need'
            WHEN total_chronic_disease_burden > 2000 AND median_household_income < 60000 THEN 'High Care Management Need'
            WHEN total_chronic_disease_burden > 1000 THEN 'Moderate Care Management Need'
            ELSE 'Standard Care Management Need'
          END as care_management_priority,
          -- Prevention opportunity score
          ROUND(
            (estimated_diabetes_high_risk * 0.3) +  -- Diabetes prevention programs
            (estimated_heart_disease_risk * 0.4) +  -- Cardiac rehabilitation
            (estimated_hypertension_cases * 0.2)    -- Hypertension management
          ) as prevention_opportunity_score
        FROM disease_burden_analysis
        WHERE (
          (:geography_type = 'state' AND state IN (:geography_codes)) OR
          (:geography_type = 'county' AND county IN (:geography_codes)) OR
          (:geography_type = 'all')
        )
        ORDER BY chronic_disease_rate_pct DESC, total_chronic_burden DESC
      `,
      parameters: {
        geography_type: { type: 'string', required: true },
        geography_codes: { type: 'array', required: true },
        disease_focus: { type: 'string', required: false }
      },
      estimatedExecutionTimeMs: 400,
      optimizationHints: ['add_limit']
    };
  }

  static getSocialDeterminantsPattern(): SqlPattern {
    return {
      id: 'population_health_social_determinants',
      name: 'Social Determinants of Health Analysis',
      description: 'Analyze social determinants impact on population health outcomes',
      category: 'population_health',
      sqlTemplate: `
        WITH social_determinants AS (
          SELECT
            county, state,
            population_total,
            population_65_plus,
            median_household_income,
            -- Economic stability indicators
            CASE
              WHEN median_household_income < 25000 THEN 5  -- Severe economic instability
              WHEN median_household_income < 35000 THEN 4  -- High economic stress
              WHEN median_household_income < 50000 THEN 3  -- Moderate economic challenges
              WHEN median_household_income < 75000 THEN 2  -- Stable but limited resources
              ELSE 1  -- Economic stability
            END as economic_stability_score,
            -- Education access proxy (higher income areas typically have better education)
            CASE
              WHEN median_household_income < 30000 THEN 4  -- Limited education access
              WHEN median_household_income < 50000 THEN 3  -- Moderate education access
              WHEN median_household_income < 80000 THEN 2  -- Good education access
              ELSE 1  -- Excellent education access
            END as education_access_score,
            -- Healthcare access score (based on population density and income)
            CASE
              WHEN population_total < 25000 AND median_household_income < 40000 THEN 5  -- Rural + low income
              WHEN population_total < 25000 THEN 3  -- Rural but adequate income
              WHEN median_household_income < 30000 THEN 4  -- Urban but very low income
              WHEN median_household_income < 50000 THEN 2  -- Urban with moderate income
              ELSE 1  -- Urban with good income
            END as healthcare_access_score,
            -- Social/community context score
            CASE
              WHEN population_total < 15000 THEN 3  -- Very small community (isolation risk)
              WHEN population_total < 50000 THEN 2  -- Small community
              WHEN population_total > 500000 THEN 2  -- Very large city (social fragmentation risk)
              ELSE 1  -- Optimal community size
            END as social_context_score
          FROM demographics
          WHERE population_total > 0
        ),
        sdh_analysis AS (
          SELECT *,
            (economic_stability_score + education_access_score + healthcare_access_score + social_context_score) as composite_sdh_score,
            -- Calculate health outcome risk based on social determinants
            CASE
              WHEN (economic_stability_score + education_access_score + healthcare_access_score + social_context_score) >= 15 THEN 0.85
              WHEN (economic_stability_score + education_access_score + healthcare_access_score + social_context_score) >= 12 THEN 0.75
              WHEN (economic_stability_score + education_access_score + healthcare_access_score + social_context_score) >= 9 THEN 0.65
              WHEN (economic_stability_score + education_access_score + healthcare_access_score + social_context_score) >= 6 THEN 0.55
              ELSE 0.45
            END as health_outcome_risk_multiplier
          FROM social_determinants
        )
        SELECT
          county, state,
          population_total,
          population_65_plus,
          median_household_income,
          economic_stability_score,
          education_access_score,
          healthcare_access_score,
          social_context_score,
          composite_sdh_score,
          CASE
            WHEN composite_sdh_score >= 16 THEN 'Critical SDH Risk'
            WHEN composite_sdh_score >= 13 THEN 'High SDH Risk'
            WHEN composite_sdh_score >= 10 THEN 'Moderate SDH Risk'
            WHEN composite_sdh_score >= 7 THEN 'Low SDH Risk'
            ELSE 'Minimal SDH Risk'
          END as sdh_risk_category,
          ROUND(health_outcome_risk_multiplier * 100, 1) as health_outcome_risk_pct,
          -- Intervention recommendations
          CASE
            WHEN economic_stability_score >= 4 THEN 'Economic Support Programs'
            WHEN education_access_score >= 3 THEN 'Education & Health Literacy Programs'
            WHEN healthcare_access_score >= 4 THEN 'Healthcare Access Expansion'
            WHEN social_context_score >= 3 THEN 'Community Building Programs'
            ELSE 'Standard Interventions'
          END as primary_intervention_need,
          -- Calculate estimated impact on health outcomes
          ROUND(population_65_plus * health_outcome_risk_multiplier * 0.25) as estimated_poor_health_outcomes,
          -- Community resilience score (inverse of SDH risk)
          ROUND(20 - composite_sdh_score) as community_resilience_score,
          CASE
            WHEN composite_sdh_score >= 13 AND population_total > 10000 THEN 'High Priority for Community Health Investment'
            WHEN composite_sdh_score >= 10 AND population_total > 5000 THEN 'Moderate Priority for Community Health Investment'
            ELSE 'Standard Community Health Priority'
          END as investment_priority
        FROM sdh_analysis
        WHERE (
          (:geography_type = 'state' AND state IN (:geography_codes)) OR
          (:geography_type = 'county' AND county IN (:geography_codes)) OR
          (:geography_type = 'all')
        )
        ORDER BY composite_sdh_score DESC, estimated_poor_health_outcomes DESC
      `,
      parameters: {
        geography_type: { type: 'string', required: true },
        geography_codes: { type: 'array', required: true },
        focus_area: { type: 'string', required: false }
      },
      estimatedExecutionTimeMs: 450,
      optimizationHints: ['add_limit']
    };
  }

  static getHealthEquityPattern(): SqlPattern {
    return {
      id: 'population_health_equity_analysis',
      name: 'Health Equity Gap Analysis',
      description: 'Identify health equity gaps and disparities across communities',
      category: 'population_health',
      sqlTemplate: `
        WITH equity_baseline AS (
          SELECT
            county, state,
            population_total,
            population_65_plus,
            median_household_income,
            -- Calculate percentiles for comparison
            NTILE(5) OVER (ORDER BY median_household_income) as income_quintile,
            NTILE(5) OVER (ORDER BY population_65_plus / NULLIF(population_total, 0)) as senior_population_quintile,
            -- Equity indicators
            median_household_income as income_level,
            ROUND(100.0 * population_65_plus / NULLIF(population_total, 0), 2) as senior_population_rate
          FROM demographics
          WHERE population_total > 0 AND median_household_income > 0
        ),
        equity_analysis AS (
          SELECT
            county, state, population_total, population_65_plus, median_household_income,
            income_quintile, senior_population_quintile, income_level, senior_population_rate,
            -- Calculate equity gaps (comparing to highest quintile)
            (SELECT AVG(median_household_income) FROM equity_baseline WHERE income_quintile = 5) - median_household_income as income_gap_from_top,
            -- Health access proxy calculations
            CASE
              WHEN income_quintile = 1 THEN 'High Health Inequity Risk'  -- Lowest income quintile
              WHEN income_quintile = 2 THEN 'Moderate-High Health Inequity Risk'
              WHEN income_quintile = 3 THEN 'Moderate Health Inequity Risk'
              WHEN income_quintile = 4 THEN 'Low-Moderate Health Inequity Risk'
              ELSE 'Low Health Inequity Risk'
            END as health_equity_risk_level,
            -- Calculate compounding factors
            CASE
              WHEN income_quintile <= 2 AND senior_population_quintile >= 4 THEN 'Compounded Vulnerability'  -- Low income + high senior population
              WHEN income_quintile <= 2 THEN 'Income-Based Vulnerability'
              WHEN senior_population_quintile >= 4 THEN 'Age-Based Vulnerability'
              ELSE 'Standard Risk Profile'
            END as vulnerability_profile,
            -- Estimate healthcare cost burden
            CASE
              WHEN income_quintile = 1 THEN median_household_income * 0.20  -- 20% of income for lowest quintile
              WHEN income_quintile = 2 THEN median_household_income * 0.15  -- 15% of income
              WHEN income_quintile = 3 THEN median_household_income * 0.12  -- 12% of income
              ELSE median_household_income * 0.10  -- 10% for higher quintiles
            END as estimated_healthcare_cost_burden
          FROM equity_baseline
        ),
        state_comparisons AS (
          SELECT
            state,
            AVG(median_household_income) as state_avg_income,
            AVG(senior_population_rate) as state_avg_senior_rate
          FROM equity_baseline
          GROUP BY state
        )
        SELECT
          ea.county, ea.state,
          ea.population_total,
          ea.population_65_plus,
          ea.median_household_income,
          ea.income_quintile,
          ROUND(ea.income_gap_from_top) as income_gap_from_highest_quintile,
          ea.health_equity_risk_level,
          ea.vulnerability_profile,
          ROUND(ea.estimated_healthcare_cost_burden) as est_annual_healthcare_cost_burden,
          ROUND(ea.estimated_healthcare_cost_burden / NULLIF(ea.median_household_income, 0) * 100, 1) as healthcare_cost_burden_pct,
          -- Compare to state averages
          ROUND(ea.median_household_income - sc.state_avg_income) as income_gap_from_state_avg,
          CASE
            WHEN ea.median_household_income < sc.state_avg_income * 0.8 THEN 'Significantly Below State Average'
            WHEN ea.median_household_income < sc.state_avg_income * 0.9 THEN 'Below State Average'
            WHEN ea.median_household_income > sc.state_avg_income * 1.2 THEN 'Significantly Above State Average'
            WHEN ea.median_household_income > sc.state_avg_income * 1.1 THEN 'Above State Average'
            ELSE 'Near State Average'
          END as state_income_comparison,
          -- Equity intervention priority
          CASE
            WHEN ea.income_quintile <= 2 AND ea.population_total > 20000 THEN 'High Equity Investment Priority'
            WHEN ea.income_quintile <= 2 AND ea.population_total > 5000 THEN 'Moderate Equity Investment Priority'
            WHEN ea.income_quintile <= 3 AND ea.population_65_plus > 5000 THEN 'Senior-Focused Equity Priority'
            ELSE 'Standard Equity Priority'
          END as equity_intervention_priority,
          -- Potential impact calculations
          ROUND(ea.population_65_plus * (6 - ea.income_quintile) * 0.1) as estimated_health_disparity_impact,
          sc.state_avg_income,
          sc.state_avg_senior_rate
        FROM equity_analysis ea
        LEFT JOIN state_comparisons sc ON ea.state = sc.state
        WHERE (
          (:geography_type = 'state' AND ea.state IN (:geography_codes)) OR
          (:geography_type = 'county' AND ea.county IN (:geography_codes)) OR
          (:geography_type = 'all')
        )
        ORDER BY ea.income_quintile ASC, ea.estimated_health_disparity_impact DESC
      `,
      parameters: {
        geography_type: { type: 'string', required: true },
        geography_codes: { type: 'array', required: true },
        focus_quintile: { type: 'number', required: false }
      },
      estimatedExecutionTimeMs: 500,
      optimizationHints: ['add_limit']
    };
  }
}

export function getPopulationHealthPatterns(): SqlPattern[] {
  return [
    PopulationHealthPatterns.getBasicRiskAssessmentPattern(),
    PopulationHealthPatterns.getChronicDiseaseRiskPattern(),
    PopulationHealthPatterns.getSocialDeterminantsPattern(),
    PopulationHealthPatterns.getHealthEquityPattern()
  ];
}