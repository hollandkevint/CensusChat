/**
 * Healthcare Facility Adequacy Patterns
 * Specialized SQL patterns for healthcare facility analysis and adequacy assessment
 */

import { SqlPattern } from './HealthcareSqlLibrary';
import { FacilityParams } from '../types/HealthcareAnalyticsTypes';

export class FacilityAdequacyPatterns {
  static getBasicFacilityAdequacyPattern(): SqlPattern {
    return {
      id: 'facility_adequacy_basic',
      name: 'Basic Healthcare Facility Adequacy Assessment',
      description: 'Assess healthcare facility adequacy using population-based ratios and geographic access',
      category: 'facility_adequacy',
      sqlTemplate: `
        WITH facility_metrics AS (
          SELECT
            county, state,
            population_total,
            population_65_plus,
            median_household_income,
            -- Standard healthcare facility ratios per population
            -- Primary care: 1 per 3,500 people (HRSA recommendation)
            ROUND(population_total / 3500.0, 1) as needed_primary_care_providers,
            -- Hospitals: 1 per 8,000-12,000 people depending on rurality
            CASE
              WHEN population_total < 50000 THEN ROUND(population_total / 8000.0, 1)  -- Rural areas need more
              ELSE ROUND(population_total / 12000.0, 1)  -- Urban areas can serve more
            END as needed_hospital_facilities,
            -- Specialty care: 1 per 15,000 people
            ROUND(population_total / 15000.0, 1) as needed_specialty_providers,
            -- Emergency services: 1 per 25,000 people
            ROUND(population_total / 25000.0, 1) as needed_emergency_services,
            -- Current facility estimates (would be replaced with real facility data)
            ROUND(population_total / 5000.0, 1) as estimated_current_primary_care,
            ROUND(population_total / 15000.0, 1) as estimated_current_hospitals,
            ROUND(population_total / 20000.0, 1) as estimated_current_specialty,
            ROUND(population_total / 30000.0, 1) as estimated_current_emergency
          FROM demographics
          WHERE population_total > 0
        ),
        adequacy_analysis AS (
          SELECT *,
            -- Calculate adequacy ratios (current / needed)
            ROUND(estimated_current_primary_care / NULLIF(needed_primary_care_providers, 0), 2) as primary_care_adequacy_ratio,
            ROUND(estimated_current_hospitals / NULLIF(needed_hospital_facilities, 0), 2) as hospital_adequacy_ratio,
            ROUND(estimated_current_specialty / NULLIF(needed_specialty_providers, 0), 2) as specialty_adequacy_ratio,
            ROUND(estimated_current_emergency / NULLIF(needed_emergency_services, 0), 2) as emergency_adequacy_ratio,
            -- Calculate gaps
            needed_primary_care_providers - estimated_current_primary_care as primary_care_gap,
            needed_hospital_facilities - estimated_current_hospitals as hospital_gap,
            needed_specialty_providers - estimated_current_specialty as specialty_gap,
            needed_emergency_services - estimated_current_emergency as emergency_gap
          FROM facility_metrics
        ),
        comprehensive_scoring AS (
          SELECT *,
            -- Composite adequacy score (0-4 scale, 4 being best)
            ROUND(
              LEAST(primary_care_adequacy_ratio, 2.0) * 0.35 +  -- 35% weight for primary care
              LEAST(hospital_adequacy_ratio, 2.0) * 0.30 +      -- 30% weight for hospitals
              LEAST(specialty_adequacy_ratio, 2.0) * 0.20 +     -- 20% weight for specialty
              LEAST(emergency_adequacy_ratio, 2.0) * 0.15,      -- 15% weight for emergency
              2
            ) as composite_adequacy_score
          FROM adequacy_analysis
        )
        SELECT
          county, state,
          population_total,
          population_65_plus,
          median_household_income,
          -- Current vs Needed Facilities
          ROUND(estimated_current_primary_care) as current_primary_care_est,
          ROUND(needed_primary_care_providers) as needed_primary_care,
          ROUND(primary_care_gap, 1) as primary_care_gap,
          ROUND(estimated_current_hospitals) as current_hospitals_est,
          ROUND(needed_hospital_facilities) as needed_hospitals,
          ROUND(hospital_gap, 1) as hospital_gap,
          -- Adequacy ratios
          primary_care_adequacy_ratio,
          hospital_adequacy_ratio,
          specialty_adequacy_ratio,
          emergency_adequacy_ratio,
          composite_adequacy_score,
          -- Overall adequacy rating
          CASE
            WHEN composite_adequacy_score >= 1.5 THEN 'Well Served'
            WHEN composite_adequacy_score >= 1.0 THEN 'Adequately Served'
            WHEN composite_adequacy_score >= 0.7 THEN 'Underserved'
            WHEN composite_adequacy_score >= 0.5 THEN 'Significantly Underserved'
            ELSE 'Critically Underserved'
          END as overall_adequacy_rating,
          -- Priority scoring for facility development (higher = more urgent need)
          ROUND(
            (2.0 - composite_adequacy_score) * LOG(population_total + 1) *
            CASE
              WHEN median_household_income < 40000 THEN 1.5  -- Higher priority for low-income areas
              WHEN median_household_income < 60000 THEN 1.2
              ELSE 1.0
            END
          ) as development_priority_score,
          -- Senior population considerations
          CASE
            WHEN population_65_plus / NULLIF(population_total, 0) > 0.20 AND composite_adequacy_score < 1.0 THEN 'High Senior Care Priority'
            WHEN population_65_plus / NULLIF(population_total, 0) > 0.15 AND composite_adequacy_score < 0.8 THEN 'Moderate Senior Care Priority'
            ELSE 'Standard Care Priority'
          END as senior_care_priority,
          -- Economic feasibility indicator
          CASE
            WHEN median_household_income > 60000 AND composite_adequacy_score < 1.0 THEN 'Economically Viable Expansion'
            WHEN median_household_income > 45000 AND composite_adequacy_score < 0.7 THEN 'Moderate Economic Viability'
            WHEN composite_adequacy_score < 0.5 THEN 'Public Investment Needed'
            ELSE 'Market-Driven Development'
          END as economic_viability_assessment
        FROM comprehensive_scoring
        WHERE (
          (:geography_type = 'state' AND state IN (:geography_codes)) OR
          (:geography_type = 'county' AND county IN (:geography_codes)) OR
          (:geography_type = 'all')
        )
        ORDER BY development_priority_score DESC, composite_adequacy_score ASC
      `,
      parameters: {
        geography_type: { type: 'string', required: true },
        geography_codes: { type: 'array', required: true },
        facility_type: { type: 'string', required: false }
      },
      estimatedExecutionTimeMs: 400,
      optimizationHints: ['add_limit', 'force_index_scan']
    };
  }

  static getSpecialtyServiceAccessPattern(): SqlPattern {
    return {
      id: 'facility_adequacy_specialty_access',
      name: 'Specialty Healthcare Service Access Analysis',
      description: 'Analyze access to specialized healthcare services by population needs',
      category: 'facility_adequacy',
      sqlTemplate: `
        WITH specialty_needs_analysis AS (
          SELECT
            county, state,
            population_total,
            population_65_plus,
            median_household_income,
            -- Calculate specialty service needs based on demographics
            -- Cardiology needs (higher in older populations)
            ROUND(population_65_plus * 0.25) as cardiology_need_estimate,
            ROUND(population_total / 25000.0) as cardiology_providers_needed,
            -- Oncology needs (age-adjusted)
            ROUND(
              (population_65_plus * 0.12) +  -- 12% of seniors may need oncology
              ((population_total - population_65_plus) * 0.03)  -- 3% of younger population
            ) as oncology_need_estimate,
            ROUND(population_total / 40000.0) as oncology_providers_needed,
            -- Orthopedics needs (high in senior population)
            ROUND(population_65_plus * 0.30) as orthopedics_need_estimate,
            ROUND(population_total / 20000.0) as orthopedics_providers_needed,
            -- Mental health needs (across all ages)
            ROUND(population_total * 0.18) as mental_health_need_estimate,
            ROUND(population_total / 8000.0) as mental_health_providers_needed,
            -- Endocrinology (diabetes focus)
            ROUND(population_65_plus * 0.15) as endocrinology_need_estimate,
            ROUND(population_total / 35000.0) as endocrinology_providers_needed
          FROM demographics
          WHERE population_total > 0
        ),
        service_accessibility AS (
          SELECT *,
            -- Estimated current providers (in reality, would come from provider database)
            ROUND(population_total / 35000.0) as estimated_cardiology_providers,
            ROUND(population_total / 50000.0) as estimated_oncology_providers,
            ROUND(population_total / 30000.0) as estimated_orthopedics_providers,
            ROUND(population_total / 12000.0) as estimated_mental_health_providers,
            ROUND(population_total / 45000.0) as estimated_endocrinology_providers,
            -- Distance/access factors
            CASE
              WHEN population_total < 25000 THEN 2.0  -- Rural areas have distance challenges
              WHEN population_total < 100000 THEN 1.5  -- Smaller cities
              ELSE 1.0  -- Major metropolitan areas
            END as geographic_access_multiplier
          FROM specialty_needs_analysis
        ),
        access_gaps AS (
          SELECT *,
            -- Calculate service gaps (need - availability)
            cardiology_providers_needed * geographic_access_multiplier - estimated_cardiology_providers as cardiology_gap,
            oncology_providers_needed * geographic_access_multiplier - estimated_oncology_providers as oncology_gap,
            orthopedics_providers_needed * geographic_access_multiplier - estimated_orthopedics_providers as orthopedics_gap,
            mental_health_providers_needed * geographic_access_multiplier - estimated_mental_health_providers as mental_health_gap,
            endocrinology_providers_needed * geographic_access_multiplier - estimated_endocrinology_providers as endocrinology_gap
          FROM service_accessibility
        )
        SELECT
          county, state,
          population_total,
          population_65_plus,
          median_household_income,
          -- Service needs
          cardiology_need_estimate,
          oncology_need_estimate,
          orthopedics_need_estimate,
          mental_health_need_estimate,
          endocrinology_need_estimate,
          -- Provider gaps
          ROUND(cardiology_gap, 1) as cardiology_provider_gap,
          ROUND(oncology_gap, 1) as oncology_provider_gap,
          ROUND(orthopedics_gap, 1) as orthopedics_provider_gap,
          ROUND(mental_health_gap, 1) as mental_health_provider_gap,
          ROUND(endocrinology_gap, 1) as endocrinology_provider_gap,
          -- Overall specialty access score
          ROUND(
            CASE
              WHEN cardiology_gap <= 0 THEN 1 ELSE 0 END +
            CASE
              WHEN oncology_gap <= 0 THEN 1 ELSE 0 END +
            CASE
              WHEN orthopedics_gap <= 0 THEN 1 ELSE 0 END +
            CASE
              WHEN mental_health_gap <= 0 THEN 1 ELSE 0 END +
            CASE
              WHEN endocrinology_gap <= 0 THEN 1 ELSE 0 END
          ) as specialty_services_available_count,
          -- Priority specialty based on largest gap
          CASE
            WHEN mental_health_gap = GREATEST(cardiology_gap, oncology_gap, orthopedics_gap, mental_health_gap, endocrinology_gap) THEN 'Mental Health'
            WHEN cardiology_gap = GREATEST(cardiology_gap, oncology_gap, orthopedics_gap, mental_health_gap, endocrinology_gap) THEN 'Cardiology'
            WHEN orthopedics_gap = GREATEST(cardiology_gap, oncology_gap, orthopedics_gap, mental_health_gap, endocrinology_gap) THEN 'Orthopedics'
            WHEN oncology_gap = GREATEST(cardiology_gap, oncology_gap, orthopedics_gap, mental_health_gap, endocrinology_gap) THEN 'Oncology'
            ELSE 'Endocrinology'
          END as highest_priority_specialty,
          -- Access rating
          CASE
            WHEN specialty_services_available_count >= 4 THEN 'Excellent Specialty Access'
            WHEN specialty_services_available_count >= 3 THEN 'Good Specialty Access'
            WHEN specialty_services_available_count >= 2 THEN 'Moderate Specialty Access'
            WHEN specialty_services_available_count >= 1 THEN 'Limited Specialty Access'
            ELSE 'Poor Specialty Access'
          END as specialty_access_rating,
          -- Development opportunity score
          ROUND(
            (cardiology_gap + oncology_gap + orthopedics_gap + mental_health_gap + endocrinology_gap) *
            LOG(population_total + 1) / 10 *
            CASE
              WHEN median_household_income > 60000 THEN 1.3  -- Higher income = better specialty market
              WHEN median_household_income > 45000 THEN 1.1
              ELSE 0.8
            END
          ) as specialty_development_opportunity_score,
          geographic_access_multiplier
        FROM access_gaps
        WHERE (
          (:geography_type = 'state' AND state IN (:geography_codes)) OR
          (:geography_type = 'county' AND county IN (:geography_codes)) OR
          (:geography_type = 'all')
        )
        ORDER BY specialty_development_opportunity_score DESC, specialty_services_available_count ASC
      `,
      parameters: {
        geography_type: { type: 'string', required: true },
        geography_codes: { type: 'array', required: true },
        specialty_focus: { type: 'string', required: false }
      },
      estimatedExecutionTimeMs: 500,
      optimizationHints: ['add_limit']
    };
  }

  static getRuralHealthAccessPattern(): SqlPattern {
    return {
      id: 'facility_adequacy_rural_health_access',
      name: 'Rural Healthcare Access Analysis',
      description: 'Specialized analysis for rural healthcare facility adequacy and access challenges',
      category: 'facility_adequacy',
      sqlTemplate: `
        WITH rural_classification AS (
          SELECT
            county, state,
            population_total,
            population_65_plus,
            median_household_income,
            -- Rural classification based on population density
            CASE
              WHEN population_total < 10000 THEN 'Very Rural'
              WHEN population_total < 25000 THEN 'Rural'
              WHEN population_total < 50000 THEN 'Small Town'
              WHEN population_total < 250000 THEN 'Suburban'
              ELSE 'Urban'
            END as rurality_classification,
            -- Distance factors (rural areas face longer travel distances)
            CASE
              WHEN population_total < 10000 THEN 45  -- Average 45 minutes to healthcare
              WHEN population_total < 25000 THEN 30  -- Average 30 minutes
              WHEN population_total < 50000 THEN 20  -- Average 20 minutes
              ELSE 15  -- Average 15 minutes for urban
            END as avg_travel_time_minutes
          FROM demographics
          WHERE population_total > 0
        ),
        rural_health_metrics AS (
          SELECT *,
            -- Rural-specific healthcare needs
            -- Critical Access Hospital need (CAH serves areas >35 miles from another hospital)
            CASE
              WHEN rurality_classification IN ('Very Rural', 'Rural') THEN 1
              ELSE 0
            END as needs_critical_access_hospital,
            -- Rural Health Clinic eligibility
            CASE
              WHEN rurality_classification IN ('Very Rural', 'Rural') AND median_household_income < 50000 THEN 1
              ELSE 0
            END as eligible_for_rural_health_clinic,
            -- Provider shortage area likelihood
            CASE
              WHEN population_total < 20000 AND median_household_income < 45000 THEN 'High HPSA Likelihood'
              WHEN population_total < 50000 THEN 'Moderate HPSA Likelihood'
              ELSE 'Low HPSA Likelihood'
            END as provider_shortage_risk,
            -- Emergency services criticality (rural areas need closer access)
            CASE
              WHEN rurality_classification = 'Very Rural' THEN population_total / 8000.0
              WHEN rurality_classification = 'Rural' THEN population_total / 12000.0
              ELSE population_total / 25000.0
            END as emergency_services_needed,
            -- Telemedicine opportunity score
            CASE
              WHEN rurality_classification IN ('Very Rural', 'Rural') AND median_household_income > 35000 THEN 3
              WHEN rurality_classification = 'Small Town' THEN 2
              ELSE 1
            END as telemedicine_opportunity_score
          FROM rural_classification
        ),
        rural_adequacy_analysis AS (
          SELECT *,
            -- Current estimated services (would be replaced with real facility data)
            ROUND(population_total / 15000.0) as estimated_current_primary_care,
            CASE
              WHEN rurality_classification IN ('Very Rural', 'Rural') THEN ROUND(population_total / 25000.0)
              ELSE ROUND(population_total / 12000.0)
            END as estimated_current_hospitals,
            ROUND(population_total / 8000.0) as needed_primary_care_rural,
            -- Calculate rural-specific gaps
            ROUND(population_total / 8000.0) - ROUND(population_total / 15000.0) as rural_primary_care_gap,
            emergency_services_needed - ROUND(population_total / 35000.0) as emergency_services_gap
          FROM rural_health_metrics
        )
        SELECT
          county, state,
          population_total,
          population_65_plus,
          median_household_income,
          rurality_classification,
          avg_travel_time_minutes,
          -- Rural healthcare infrastructure needs
          needs_critical_access_hospital,
          eligible_for_rural_health_clinic,
          provider_shortage_risk,
          -- Service gaps specific to rural areas
          ROUND(rural_primary_care_gap, 1) as primary_care_gap,
          ROUND(emergency_services_gap, 1) as emergency_services_gap,
          ROUND(emergency_services_needed, 1) as emergency_services_needed,
          -- Rural health priorities
          CASE
            WHEN rurality_classification = 'Very Rural' AND rural_primary_care_gap > 0.5 THEN 'Critical Rural Health Priority'
            WHEN rurality_classification = 'Rural' AND rural_primary_care_gap > 0.3 THEN 'High Rural Health Priority'
            WHEN rurality_classification = 'Small Town' AND rural_primary_care_gap > 0.2 THEN 'Moderate Rural Health Priority'
            ELSE 'Standard Rural Health Priority'
          END as rural_health_priority,
          -- Transportation challenges
          CASE
            WHEN avg_travel_time_minutes > 35 AND median_household_income < 40000 THEN 'High Transportation Barrier'
            WHEN avg_travel_time_minutes > 25 THEN 'Moderate Transportation Barrier'
            ELSE 'Low Transportation Barrier'
          END as transportation_barrier_level,
          -- Economic sustainability for healthcare services
          CASE
            WHEN population_total < 5000 THEN 'Challenging Economic Sustainability'
            WHEN population_total < 15000 AND median_household_income < 40000 THEN 'Moderate Economic Sustainability Challenge'
            WHEN population_total < 25000 THEN 'Viable with Support'
            ELSE 'Economically Sustainable'
          END as healthcare_economic_sustainability,
          -- Telemedicine and mobile health opportunities
          telemedicine_opportunity_score,
          CASE
            WHEN rurality_classification IN ('Very Rural', 'Rural') AND population_65_plus > 1000 THEN 'High Mobile Health Opportunity'
            WHEN rurality_classification = 'Small Town' THEN 'Moderate Mobile Health Opportunity'
            ELSE 'Standard Mobile Health Opportunity'
          END as mobile_health_opportunity,
          -- Overall rural health development score
          ROUND(
            (rural_primary_care_gap * 0.4) +
            (emergency_services_gap * 0.3) +
            (needs_critical_access_hospital * 2.0) +
            (telemedicine_opportunity_score * 0.5) +
            CASE WHEN median_household_income < 35000 THEN 1.5 ELSE 0 END
          ) as rural_health_development_score
        FROM rural_adequacy_analysis
        WHERE rurality_classification IN ('Very Rural', 'Rural', 'Small Town')
          AND (
            (:geography_type = 'state' AND state IN (:geography_codes)) OR
            (:geography_type = 'county' AND county IN (:geography_codes)) OR
            (:geography_type = 'all')
          )
        ORDER BY rural_health_development_score DESC, avg_travel_time_minutes DESC
      `,
      parameters: {
        geography_type: { type: 'string', required: true },
        geography_codes: { type: 'array', required: true },
        rural_focus: { type: 'string', required: false }
      },
      estimatedExecutionTimeMs: 450,
      optimizationHints: ['add_limit']
    };
  }

  static getEmergencyServicesCoveragePattern(): SqlPattern {
    return {
      id: 'facility_adequacy_emergency_coverage',
      name: 'Emergency Services Coverage Analysis',
      description: 'Analyze emergency medical services coverage and response time adequacy',
      category: 'facility_adequacy',
      sqlTemplate: `
        WITH emergency_services_baseline AS (
          SELECT
            county, state,
            population_total,
            population_65_plus,
            median_household_income,
            -- Emergency services requirements based on population and geography
            CASE
              WHEN population_total < 25000 THEN 1  -- Rural areas need at least 1 emergency facility
              WHEN population_total < 100000 THEN ROUND(population_total / 25000.0)
              ELSE ROUND(population_total / 20000.0)  -- Urban areas can support more dense coverage
            END as emergency_facilities_needed,
            -- Ambulance services needed
            ROUND(population_total / 15000.0) as ambulance_services_needed,
            -- Response time requirements
            CASE
              WHEN population_total < 15000 THEN 15  -- Rural target: 15 minutes
              WHEN population_total < 100000 THEN 12  -- Suburban target: 12 minutes
              ELSE 8  -- Urban target: 8 minutes
            END as target_response_time_minutes,
            -- Population density factor for coverage planning
            CASE
              WHEN population_total < 10000 THEN 'Very Low Density'
              WHEN population_total < 50000 THEN 'Low Density'
              WHEN population_total < 250000 THEN 'Moderate Density'
              ELSE 'High Density'
            END as population_density_category
          FROM demographics
          WHERE population_total > 0
        ),
        coverage_analysis AS (
          SELECT *,
            -- Estimated current emergency services (would be replaced with real facility data)
            ROUND(population_total / 30000.0) as estimated_current_emergency_facilities,
            ROUND(population_total / 20000.0) as estimated_current_ambulance_services,
            -- High-risk population calculations
            population_65_plus as high_risk_senior_population,
            ROUND(population_total * 0.15) as estimated_chronic_condition_population,
            -- Calculate coverage gaps
            emergency_facilities_needed - ROUND(population_total / 30000.0) as emergency_facility_gap,
            ambulance_services_needed - ROUND(population_total / 20000.0) as ambulance_service_gap
          FROM emergency_services_baseline
        ),
        risk_assessment AS (
          SELECT *,
            -- Emergency risk scoring
            CASE
              WHEN emergency_facility_gap > 1 THEN 4  -- Significant gap
              WHEN emergency_facility_gap > 0.5 THEN 3  -- Moderate gap
              WHEN emergency_facility_gap > 0 THEN 2  -- Small gap
              ELSE 1  -- Adequate or surplus
            END as facility_gap_risk_score,
            CASE
              WHEN population_density_category IN ('Very Low Density', 'Low Density') THEN 3
              WHEN population_density_category = 'Moderate Density' THEN 2
              ELSE 1
            END as geographic_risk_score,
            CASE
              WHEN (population_65_plus / NULLIF(population_total, 0)) > 0.20 THEN 3
              WHEN (population_65_plus / NULLIF(population_total, 0)) > 0.15 THEN 2
              ELSE 1
            END as demographic_risk_score,
            -- Economic factors affecting emergency services sustainability
            CASE
              WHEN median_household_income < 35000 THEN 3
              WHEN median_household_income < 55000 THEN 2
              ELSE 1
            END as economic_sustainability_risk_score
          FROM coverage_analysis
        )
        SELECT
          county, state,
          population_total,
          population_65_plus,
          median_household_income,
          population_density_category,
          target_response_time_minutes,
          -- Current vs needed emergency services
          ROUND(estimated_current_emergency_facilities) as current_emergency_facilities_est,
          ROUND(emergency_facilities_needed) as emergency_facilities_needed,
          ROUND(emergency_facility_gap, 1) as emergency_facility_gap,
          ROUND(estimated_current_ambulance_services) as current_ambulance_services_est,
          ROUND(ambulance_services_needed) as ambulance_services_needed,
          ROUND(ambulance_service_gap, 1) as ambulance_service_gap,
          -- Risk scores
          facility_gap_risk_score,
          geographic_risk_score,
          demographic_risk_score,
          economic_sustainability_risk_score,
          (facility_gap_risk_score + geographic_risk_score + demographic_risk_score + economic_sustainability_risk_score) as composite_emergency_risk_score,
          -- Coverage adequacy rating
          CASE
            WHEN (facility_gap_risk_score + geographic_risk_score + demographic_risk_score + economic_sustainability_risk_score) >= 11 THEN 'Critical Emergency Coverage Gap'
            WHEN (facility_gap_risk_score + geographic_risk_score + demographic_risk_score + economic_sustainability_risk_score) >= 8 THEN 'Significant Emergency Coverage Gap'
            WHEN (facility_gap_risk_score + geographic_risk_score + demographic_risk_score + economic_sustainability_risk_score) >= 6 THEN 'Moderate Emergency Coverage Gap'
            WHEN (facility_gap_risk_score + geographic_risk_score + demographic_risk_score + economic_sustainability_risk_score) >= 4 THEN 'Minor Emergency Coverage Gap'
            ELSE 'Adequate Emergency Coverage'
          END as emergency_coverage_rating,
          -- High-risk population served
          high_risk_senior_population,
          estimated_chronic_condition_population,
          -- Development priority
          CASE
            WHEN emergency_facility_gap > 1 AND population_total > 20000 THEN 'High Emergency Services Development Priority'
            WHEN emergency_facility_gap > 0.5 AND population_65_plus > 2000 THEN 'Moderate Emergency Services Development Priority'
            WHEN ambulance_service_gap > 1 THEN 'Ambulance Service Development Priority'
            ELSE 'Standard Emergency Services Priority'
          END as emergency_development_priority,
          -- Investment opportunity score
          ROUND(
            emergency_facility_gap * 3.0 +
            ambulance_service_gap * 2.0 +
            (population_65_plus / 1000.0) +
            CASE WHEN median_household_income > 50000 THEN 2.0 ELSE 1.0 END
          ) as emergency_services_investment_score,
          -- Special considerations
          CASE
            WHEN population_density_category = 'Very Low Density' AND emergency_facility_gap > 0.5 THEN 'Consider Mobile Emergency Units'
            WHEN geographic_risk_score >= 3 AND ambulance_service_gap > 0.5 THEN 'Consider Air Medical Services'
            WHEN demographic_risk_score >= 3 THEN 'Focus on Senior Emergency Care Capabilities'
            ELSE 'Standard Emergency Service Development'
          END as special_emergency_considerations
        FROM risk_assessment
        WHERE (
          (:geography_type = 'state' AND state IN (:geography_codes)) OR
          (:geography_type = 'county' AND county IN (:geography_codes)) OR
          (:geography_type = 'all')
        )
        ORDER BY composite_emergency_risk_score DESC, emergency_services_investment_score DESC
      `,
      parameters: {
        geography_type: { type: 'string', required: true },
        geography_codes: { type: 'array', required: true },
        emergency_focus: { type: 'string', required: false }
      },
      estimatedExecutionTimeMs: 450,
      optimizationHints: ['add_limit']
    };
  }
}

export function getFacilityAdequacyPatterns(): SqlPattern[] {
  return [
    FacilityAdequacyPatterns.getBasicFacilityAdequacyPattern(),
    FacilityAdequacyPatterns.getSpecialtyServiceAccessPattern(),
    FacilityAdequacyPatterns.getRuralHealthAccessPattern(),
    FacilityAdequacyPatterns.getEmergencyServicesCoveragePattern()
  ];
}