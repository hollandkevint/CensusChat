# Healthcare Analytics Patterns

CensusChat includes a healthcare analytics module with pre-built SQL patterns for common healthcare strategy queries. These patterns are organized into three categories: Medicare Eligibility, Population Health, and Facility Adequacy.

---

## Medicare Eligibility Patterns

### Basic Medicare Eligibility Analysis

**Pattern ID:** `medicare_basic_eligibility`

Calculates Medicare eligibility rates and categorizes senior populations.

**Key metrics produced:**
- `medicare_eligible_rate` - Percentage of population aged 65+
- `senior_population_category` - High (>20%), Moderate (>15%), or Low
- `estimated_traditional_medicare` - ~85% of 65+ population
- `estimated_medicare_advantage` - ~15% of 65+ population

**How to query directly:**
```sql
SELECT
  county_name, state_name, population,
  age_65_plus,
  ROUND(100.0 * age_65_plus / NULLIF(population, 0), 2) AS medicare_eligible_rate
FROM block_group_data
WHERE state_name = 'Florida'
ORDER BY medicare_eligible_rate DESC
LIMIT 100
```

### Medicare Advantage Market Opportunity Analysis

**Pattern ID:** `medicare_advantage_opportunity`

Analyzes Medicare Advantage penetration and growth opportunities by market.

**Key metrics produced:**
- `current_ma_penetration_pct` - Estimated MA enrollment rate
- `growth_opportunity_count` - Potential new MA enrollees
- `market_opportunity_category` - High Growth, Moderate Growth, Competitive, or Mature
- `target_priority` - Priority Target, Secondary Target, or Low Priority
- `market_attractiveness_score` - Composite score (0-100) combining growth potential, income, and population

### 5-Year Medicare Eligibility Projections

**Pattern ID:** `medicare_5year_projection`

Projects Medicare eligibility growth over 5 years using 2.5% annual senior growth and 1.2% total population growth assumptions.

**Key metrics produced:**
- Year-by-year 65+ population projections
- `net_growth_5_years` - Total new seniors over 5 years
- `avg_annual_growth` - Average new seniors per year
- `growth_category` - High Growth (>15%), Moderate Growth (>10%), or Stable

### Medicare-Medicaid Dual Eligible Analysis

**Pattern ID:** `medicare_dual_eligible_analysis`

Estimates the dual eligible (Medicare + Medicaid) population based on income and age.

**Key metrics produced:**
- `estimated_dual_eligible` - Estimated count of dual eligible individuals
- `dual_eligible_rate_pct` - Dual eligible rate among Medicare population
- `snp_opportunity_category` - Special Needs Plan market opportunity
- `care_coordination_need` - Level of care coordination required
- `social_determinants_risk_score` - Combined risk score for social factors

---

## Population Health Patterns

### Basic Population Health Risk Assessment

**Pattern ID:** `population_health_basic_risk`

Multi-factor risk scoring combining income, age, population density, and insurance proxies.

**Risk scoring dimensions (1-5 scale each):**
- `income_risk_score` - Based on median household income thresholds ($30K/$40K/$50K/$70K)
- `age_risk_score` - Based on percentage of population 65+ (>25%/>20%/>15%)
- `density_risk_score` - Rural areas (<15K, <50K) and very urban (>500K) score higher
- `insurance_risk_score` - Proxy based on income levels

**Composite categories:** Critical Risk (15+), Very High Risk (12+), High Risk (9+), Moderate Risk (6+), Low Risk

**Additional outputs:**
- `estimated_diabetes_cases` - ~15% of 65+ population
- `estimated_heart_disease_cases` - ~8% of 65+ population
- `estimated_mental_health_needs` - ~12% of total population
- `health_equity_priority` - Flags low-income areas with high risk scores

### Chronic Disease Risk Stratification

**Pattern ID:** `population_health_chronic_disease_risk`

Estimates chronic disease prevalence by demographic and economic factors.

**Diseases modeled:**
- Diabetes - 15-28% of seniors depending on income
- Heart disease - 16-25% of seniors depending on income
- Hypertension - ~58% of seniors (age-driven)
- COPD - 8-15% of seniors depending on income

**Key outputs:**
- `chronic_disease_rate_pct` - Overall chronic disease burden rate
- `disease_burden_category` - Very High (>180%), High (>150%), Moderate (>120%), Low
- `care_management_priority` - Based on burden and income intersection
- `prevention_opportunity_score` - Weighted score for prevention program investment

### Social Determinants of Health Analysis

**Pattern ID:** `population_health_social_determinants`

Scores communities across four SDOH domains.

**SDOH scoring dimensions (1-5 scale each):**
- `economic_stability_score` - Income-based economic stress assessment
- `education_access_score` - Education access proxy based on income
- `healthcare_access_score` - Combines rurality and income factors
- `social_context_score` - Community size and isolation risk

**Key outputs:**
- `composite_sdh_score` - Combined score across all domains
- `sdh_risk_category` - Critical (16+), High (13+), Moderate (10+), Low (7+), Minimal
- `primary_intervention_need` - Recommended intervention type
- `community_resilience_score` - Inverse of SDH risk (higher = more resilient)

### Health Equity Gap Analysis

**Pattern ID:** `population_health_equity_analysis`

Identifies health equity gaps using income quintiles and state-level comparisons.

**Key outputs:**
- `income_quintile` - National income quintile (1=lowest, 5=highest)
- `income_gap_from_highest_quintile` - Dollar gap from top quintile average
- `vulnerability_profile` - Compounded, Income-Based, Age-Based, or Standard
- `healthcare_cost_burden_pct` - Estimated healthcare cost as percentage of income (10-20%)
- `state_income_comparison` - How the area compares to its state average
- `equity_intervention_priority` - Investment priority level

---

## Facility Adequacy Patterns

### Basic Healthcare Facility Adequacy Assessment

**Pattern ID:** `facility_adequacy_basic`

Estimates healthcare facility needs using population-based ratios.

**Standard ratios used:**
- Primary care: 1 provider per 3,500 people (HRSA recommendation)
- Hospitals: 1 per 8,000-12,000 people (varies by rurality)
- Specialty care: 1 per 15,000 people
- Emergency services: 1 per 25,000 people

**Key outputs:**
- Adequacy ratios (current/needed) for each facility type
- `composite_adequacy_score` - Weighted composite (0-4 scale)
- `overall_adequacy_rating` - Well Served, Adequately Served, Underserved, Significantly Underserved, Critically Underserved
- `development_priority_score` - Population-weighted priority for facility development
- `economic_viability_assessment` - Whether market conditions support new facilities

### Specialty Healthcare Service Access Analysis

**Pattern ID:** `facility_adequacy_specialty_access`

Analyzes access to five specialty healthcare services.

**Specialties analyzed:**
- Cardiology - ~25% of seniors need services; 1 per 25,000 population
- Oncology - ~12% of seniors + 3% younger adults; 1 per 40,000 population
- Orthopedics - ~30% of seniors; 1 per 20,000 population
- Mental health - ~18% of all ages; 1 per 8,000 population
- Endocrinology - ~15% of seniors (diabetes focus); 1 per 35,000 population

**Key outputs:**
- Provider gap for each specialty
- `highest_priority_specialty` - Specialty with the largest access gap
- `specialty_access_rating` - Excellent (4+ met), Good (3+), Moderate (2+), Limited (1+), Poor
- `specialty_development_opportunity_score` - Market opportunity weighted by income and population

### Rural Healthcare Access Analysis

**Pattern ID:** `facility_adequacy_rural_health_access`

Specialized analysis for rural and small-town healthcare access.

**Rurality classification:**
- Very Rural: <10,000 population
- Rural: 10,000-24,999
- Small Town: 25,000-49,999
- Suburban: 50,000-249,999
- Urban: 250,000+

**Key outputs:**
- `avg_travel_time_minutes` - Estimated average travel time to healthcare (15-45 min)
- `needs_critical_access_hospital` - Whether the area qualifies for CAH designation
- `eligible_for_rural_health_clinic` - RHC eligibility flag
- `provider_shortage_risk` - HPSA (Health Professional Shortage Area) likelihood
- `telemedicine_opportunity_score` - Rating for telehealth investment potential
- `healthcare_economic_sustainability` - Whether healthcare services are economically viable

### Emergency Services Coverage Analysis

**Pattern ID:** `facility_adequacy_emergency_coverage`

Assesses emergency medical services coverage and identifies gaps.

**Risk scoring dimensions:**
- `facility_gap_risk_score` - Based on gap between needed and estimated facilities
- `geographic_risk_score` - Based on population density category
- `demographic_risk_score` - Based on senior population percentage
- `economic_sustainability_risk_score` - Based on income levels

**Key outputs:**
- `composite_emergency_risk_score` - Sum of all risk dimensions
- `emergency_coverage_rating` - Critical Gap (11+), Significant (8+), Moderate (6+), Minor (4+), Adequate
- `emergency_development_priority` - Prioritization for emergency service expansion
- `special_emergency_considerations` - Recommendations (mobile units, air medical, senior care focus)
