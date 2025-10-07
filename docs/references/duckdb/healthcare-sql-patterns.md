# Healthcare SQL Patterns for DuckDB

*Specialized SQL patterns for healthcare analytics and Census data processing*

## Medicare Eligibility Analysis

### Basic Medicare Eligibility Calculations
```sql
-- Calculate Medicare eligibility rates by county
SELECT
  state,
  county,
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
ORDER BY medicare_eligible_rate DESC;

-- Medicare Advantage market opportunity analysis
WITH ma_eligibility AS (
  SELECT
    geo_id,
    state,
    county,
    population_65_plus,
    -- Estimate MA eligibility (excluding ESRD and other exclusions)
    ROUND(population_65_plus * 0.85, 0) as estimated_ma_eligible,
    -- Current MA enrollment (would come from CMS data)
    COALESCE(current_ma_enrollment, 0) as current_enrollment
  FROM demographics
  LEFT JOIN medicare_advantage_enrollment ON demographics.geo_id = medicare_advantage_enrollment.county_fips
)
SELECT
  state,
  county,
  estimated_ma_eligible,
  current_enrollment,
  estimated_ma_eligible - current_enrollment as opportunity_gap,
  ROUND(100.0 * current_enrollment / NULLIF(estimated_ma_eligible, 0), 2) as current_penetration_rate,
  CASE
    WHEN current_enrollment / NULLIF(estimated_ma_eligible, 0) < 0.30 THEN 'Low Penetration'
    WHEN current_enrollment / NULLIF(estimated_ma_eligible, 0) < 0.50 THEN 'Moderate Penetration'
    ELSE 'High Penetration'
  END as penetration_category
FROM ma_eligibility
WHERE estimated_ma_eligible > 1000
ORDER BY opportunity_gap DESC;
```

### Advanced Medicare Analytics
```sql
-- Medicare cost and utilization projections
WITH medicare_projections AS (
  SELECT
    geo_id,
    state,
    county,
    population_65_plus as current_seniors,
    -- Project 5-year senior population growth
    ROUND(population_65_plus * POWER(1.03, 5), 0) as projected_seniors_5yr,
    -- Estimate per-capita Medicare costs
    CASE
      WHEN median_household_income > 75000 THEN 12500
      WHEN median_household_income > 50000 THEN 11000
      ELSE 10000
    END as estimated_annual_cost_per_senior
  FROM demographics
  WHERE population_65_plus > 0
)
SELECT
  state,
  county,
  current_seniors,
  projected_seniors_5yr,
  projected_seniors_5yr - current_seniors as growth_opportunity,
  estimated_annual_cost_per_senior,
  current_seniors * estimated_annual_cost_per_senior as current_market_value,
  projected_seniors_5yr * estimated_annual_cost_per_senior as projected_market_value,
  (projected_seniors_5yr - current_seniors) * estimated_annual_cost_per_senior as growth_market_value
FROM medicare_projections
ORDER BY growth_market_value DESC;
```

## Population Health Patterns

### Health Risk Stratification
```sql
-- Population health risk stratification based on demographics
WITH risk_factors AS (
  SELECT
    geo_id,
    state,
    county,
    population_total,
    -- Age-based risk (higher % of seniors = higher risk)
    ROUND(100.0 * population_65_plus / NULLIF(population_total, 0), 2) as senior_percentage,
    -- Socioeconomic risk (lower income = higher risk)
    CASE
      WHEN median_household_income < 40000 THEN 3
      WHEN median_household_income < 60000 THEN 2
      ELSE 1
    END as income_risk_score,
    -- Education risk (lower education = higher risk)
    CASE
      WHEN pct_less_than_high_school > 20 THEN 3
      WHEN pct_less_than_high_school > 10 THEN 2
      ELSE 1
    END as education_risk_score,
    -- Insurance coverage risk
    CASE
      WHEN pct_uninsured > 15 THEN 3
      WHEN pct_uninsured > 8 THEN 2
      ELSE 1
    END as insurance_risk_score
  FROM demographics
  WHERE population_total > 0
)
SELECT
  state,
  county,
  population_total,
  senior_percentage,
  income_risk_score + education_risk_score + insurance_risk_score as composite_risk_score,
  CASE
    WHEN income_risk_score + education_risk_score + insurance_risk_score >= 8 THEN 'High Risk'
    WHEN income_risk_score + education_risk_score + insurance_risk_score >= 6 THEN 'Moderate Risk'
    ELSE 'Low Risk'
  END as risk_category,
  -- Estimate health intervention priority
  (income_risk_score + education_risk_score + insurance_risk_score) * population_total as priority_score
FROM risk_factors
ORDER BY priority_score DESC;
```

### Chronic Disease Analytics
```sql
-- Estimate chronic disease prevalence based on demographic factors
WITH disease_estimates AS (
  SELECT
    geo_id,
    state,
    county,
    population_total,
    population_65_plus,
    -- Diabetes prevalence estimation (higher in older, lower-income populations)
    CASE
      WHEN median_household_income < 40000 AND population_65_plus / NULLIF(population_total, 0) > 0.15
      THEN population_total * 0.12
      WHEN median_household_income < 60000 OR population_65_plus / NULLIF(population_total, 0) > 0.12
      THEN population_total * 0.09
      ELSE population_total * 0.07
    END as estimated_diabetes_cases,
    -- Hypertension prevalence estimation
    CASE
      WHEN population_65_plus / NULLIF(population_total, 0) > 0.20
      THEN population_total * 0.35
      WHEN population_65_plus / NULLIF(population_total, 0) > 0.15
      THEN population_total * 0.28
      ELSE population_total * 0.22
    END as estimated_hypertension_cases,
    -- Heart disease prevalence estimation
    population_65_plus * 0.28 + (population_total - population_65_plus) * 0.05 as estimated_heart_disease_cases
  FROM demographics
  WHERE population_total > 0
)
SELECT
  state,
  county,
  population_total,
  ROUND(estimated_diabetes_cases, 0) as est_diabetes_cases,
  ROUND(estimated_hypertension_cases, 0) as est_hypertension_cases,
  ROUND(estimated_heart_disease_cases, 0) as est_heart_disease_cases,
  ROUND(100.0 * estimated_diabetes_cases / population_total, 2) as diabetes_prevalence_pct,
  ROUND(100.0 * estimated_hypertension_cases / population_total, 2) as hypertension_prevalence_pct,
  ROUND(100.0 * estimated_heart_disease_cases / population_total, 2) as heart_disease_prevalence_pct
FROM disease_estimates
WHERE population_total > 5000
ORDER BY est_diabetes_cases DESC;
```

## Healthcare Facility Analysis

### Facility Accessibility Assessment
```sql
-- Healthcare facility accessibility analysis
WITH facility_metrics AS (
  SELECT
    county_fips,
    COUNT(*) as total_facilities,
    COUNT(CASE WHEN facility_type = 'hospital' THEN 1 END) as hospitals,
    COUNT(CASE WHEN facility_type = 'clinic' THEN 1 END) as clinics,
    COUNT(CASE WHEN facility_type = 'urgent_care' THEN 1 END) as urgent_care_centers,
    -- Calculate specialty care availability
    COUNT(CASE WHEN services LIKE '%cardiology%' THEN 1 END) as cardiology_providers,
    COUNT(CASE WHEN services LIKE '%oncology%' THEN 1 END) as oncology_providers,
    COUNT(CASE WHEN services LIKE '%orthopedic%' THEN 1 END) as orthopedic_providers
  FROM healthcare_facilities
  GROUP BY county_fips
)
SELECT
  d.state,
  d.county,
  d.population_total,
  d.population_65_plus,
  COALESCE(f.total_facilities, 0) as total_facilities,
  COALESCE(f.hospitals, 0) as hospitals,
  COALESCE(f.clinics, 0) as clinics,
  -- Calculate facilities per capita
  ROUND(COALESCE(f.total_facilities, 0) * 10000.0 / d.population_total, 2) as facilities_per_10k,
  ROUND(COALESCE(f.hospitals, 0) * 100000.0 / d.population_total, 2) as hospitals_per_100k,
  -- Senior-specific metrics
  ROUND(COALESCE(f.cardiology_providers, 0) * 10000.0 / NULLIF(d.population_65_plus, 0), 2) as cardiology_per_10k_seniors,
  -- Accessibility assessment
  CASE
    WHEN COALESCE(f.total_facilities, 0) * 10000.0 / d.population_total < 5 THEN 'Underserved'
    WHEN COALESCE(f.total_facilities, 0) * 10000.0 / d.population_total > 15 THEN 'Well Served'
    ELSE 'Adequately Served'
  END as accessibility_rating
FROM demographics d
LEFT JOIN facility_metrics f ON d.geo_id = f.county_fips
WHERE d.population_total > 1000
ORDER BY facilities_per_10k;
```

### Provider Network Adequacy
```sql
-- Provider network adequacy for Medicare Advantage
WITH provider_adequacy AS (
  SELECT
    county_fips,
    -- Primary care adequacy (CMS standard: 1 PCP per 2,500 beneficiaries)
    COUNT(CASE WHEN specialty = 'primary_care' THEN 1 END) as primary_care_providers,
    -- Specialist adequacy
    COUNT(CASE WHEN specialty = 'cardiology' THEN 1 END) as cardiologists,
    COUNT(CASE WHEN specialty = 'endocrinology' THEN 1 END) as endocrinologists,
    COUNT(CASE WHEN specialty = 'orthopedics' THEN 1 END) as orthopedists,
    -- Mental health adequacy
    COUNT(CASE WHEN specialty IN ('psychiatry', 'psychology') THEN 1 END) as mental_health_providers
  FROM healthcare_providers
  WHERE accepts_medicare = true
  GROUP BY county_fips
)
SELECT
  d.state,
  d.county,
  d.population_65_plus as medicare_eligible,
  COALESCE(p.primary_care_providers, 0) as pcp_count,
  COALESCE(p.cardiologists, 0) as cardiology_count,
  COALESCE(p.mental_health_providers, 0) as mental_health_count,
  -- Adequacy ratios (Medicare beneficiaries per provider)
  ROUND(d.population_65_plus / NULLIF(COALESCE(p.primary_care_providers, 0), 0), 0) as beneficiaries_per_pcp,
  ROUND(d.population_65_plus / NULLIF(COALESCE(p.cardiologists, 0), 0), 0) as beneficiaries_per_cardiologist,
  -- CMS adequacy standards compliance
  CASE
    WHEN COALESCE(p.primary_care_providers, 0) = 0 THEN 'No PCPs'
    WHEN d.population_65_plus / COALESCE(p.primary_care_providers, 0) > 2500 THEN 'Inadequate PCP'
    ELSE 'Adequate PCP'
  END as pcp_adequacy,
  CASE
    WHEN COALESCE(p.cardiologists, 0) = 0 THEN 'No Cardiologists'
    WHEN d.population_65_plus / COALESCE(p.cardiologists, 0) > 15000 THEN 'Inadequate Cardiology'
    ELSE 'Adequate Cardiology'
  END as cardiology_adequacy
FROM demographics d
LEFT JOIN provider_adequacy p ON d.geo_id = p.county_fips
WHERE d.population_65_plus > 500
ORDER BY beneficiaries_per_pcp DESC;
```

## Geographic and Demographic Analysis

### Rural vs Urban Healthcare Patterns
```sql
-- Rural vs Urban healthcare access analysis
WITH rural_urban_classification AS (
  SELECT
    geo_id,
    state,
    county,
    population_total,
    population_65_plus,
    population_density,
    CASE
      WHEN population_density < 50 THEN 'Rural'
      WHEN population_density < 500 THEN 'Suburban'
      ELSE 'Urban'
    END as area_type,
    median_household_income,
    pct_uninsured
  FROM demographics
  WHERE population_total > 0
)
SELECT
  area_type,
  COUNT(*) as county_count,
  SUM(population_total) as total_population,
  SUM(population_65_plus) as total_seniors,
  ROUND(AVG(population_65_plus * 100.0 / population_total), 2) as avg_senior_percentage,
  ROUND(AVG(median_household_income), 0) as avg_median_income,
  ROUND(AVG(pct_uninsured), 2) as avg_uninsured_rate,
  -- Healthcare access metrics by area type
  ROUND(AVG(population_total / NULLIF(facility_count, 0)), 0) as avg_population_per_facility
FROM rural_urban_classification r
LEFT JOIN (
  SELECT county_fips, COUNT(*) as facility_count
  FROM healthcare_facilities
  GROUP BY county_fips
) f ON r.geo_id = f.county_fips
GROUP BY area_type
ORDER BY
  CASE area_type
    WHEN 'Rural' THEN 1
    WHEN 'Suburban' THEN 2
    WHEN 'Urban' THEN 3
  END;
```

### State-Level Healthcare Rankings
```sql
-- State-level healthcare system performance rankings
WITH state_metrics AS (
  SELECT
    state,
    SUM(population_total) as state_population,
    SUM(population_65_plus) as state_seniors,
    ROUND(AVG(median_household_income), 0) as avg_income,
    ROUND(AVG(pct_uninsured), 2) as avg_uninsured_rate,
    COUNT(*) as county_count
  FROM demographics
  WHERE population_total > 0
  GROUP BY state
),
facility_metrics AS (
  SELECT
    d.state,
    COUNT(f.facility_id) as total_facilities,
    COUNT(CASE WHEN f.facility_type = 'hospital' THEN 1 END) as hospitals,
    SUM(f.bed_count) as total_beds
  FROM demographics d
  LEFT JOIN healthcare_facilities f ON d.geo_id = f.county_fips
  GROUP BY d.state
)
SELECT
  s.state,
  s.state_population,
  s.state_seniors,
  s.avg_income,
  s.avg_uninsured_rate,
  COALESCE(f.total_facilities, 0) as facilities,
  COALESCE(f.hospitals, 0) as hospitals,
  COALESCE(f.total_beds, 0) as hospital_beds,
  -- Calculate per-capita metrics
  ROUND(COALESCE(f.total_facilities, 0) * 100000.0 / s.state_population, 2) as facilities_per_100k,
  ROUND(COALESCE(f.hospitals, 0) * 100000.0 / s.state_population, 2) as hospitals_per_100k,
  ROUND(COALESCE(f.total_beds, 0) * 1000.0 / s.state_population, 2) as beds_per_1k,
  -- Senior-specific metrics
  ROUND(COALESCE(f.total_beds, 0) * 100.0 / s.state_seniors, 2) as beds_per_100_seniors,
  -- Rankings
  RANK() OVER (ORDER BY COALESCE(f.total_facilities, 0) * 100000.0 / s.state_population DESC) as facility_density_rank,
  RANK() OVER (ORDER BY s.avg_uninsured_rate) as insurance_coverage_rank
FROM state_metrics s
LEFT JOIN facility_metrics f ON s.state = f.state
ORDER BY facilities_per_100k DESC;
```

## Time Series and Trend Analysis

### Population Growth Projections
```sql
-- Medicare-eligible population growth projections
WITH historical_data AS (
  SELECT
    geo_id,
    state,
    county,
    survey_year,
    population_65_plus,
    LAG(population_65_plus, 1) OVER (
      PARTITION BY geo_id ORDER BY survey_year
    ) as prev_year_seniors,
    LAG(population_65_plus, 5) OVER (
      PARTITION BY geo_id ORDER BY survey_year
    ) as five_years_ago_seniors
  FROM demographics_historical
  WHERE survey_year >= 2010
),
growth_rates AS (
  SELECT
    geo_id,
    state,
    county,
    survey_year,
    population_65_plus,
    -- Annual growth rate
    CASE
      WHEN prev_year_seniors > 0
      THEN (population_65_plus - prev_year_seniors) * 100.0 / prev_year_seniors
      ELSE NULL
    END as annual_growth_rate,
    -- 5-year compound annual growth rate
    CASE
      WHEN five_years_ago_seniors > 0
      THEN POWER(population_65_plus / five_years_ago_seniors, 1.0/5) * 100 - 100
      ELSE NULL
    END as cagr_5yr
  FROM historical_data
  WHERE survey_year = 2022  -- Most recent year
)
SELECT
  state,
  county,
  population_65_plus as current_seniors,
  ROUND(annual_growth_rate, 2) as annual_growth_pct,
  ROUND(cagr_5yr, 2) as cagr_5yr_pct,
  -- Project future senior population
  ROUND(population_65_plus * POWER(1 + COALESCE(cagr_5yr, 2) / 100, 5), 0) as projected_seniors_2027,
  ROUND(population_65_plus * POWER(1 + COALESCE(cagr_5yr, 2) / 100, 10), 0) as projected_seniors_2032,
  -- Growth opportunity
  ROUND(population_65_plus * POWER(1 + COALESCE(cagr_5yr, 2) / 100, 5) - population_65_plus, 0) as growth_2027,
  CASE
    WHEN cagr_5yr > 5 THEN 'High Growth'
    WHEN cagr_5yr > 2 THEN 'Moderate Growth'
    WHEN cagr_5yr > 0 THEN 'Slow Growth'
    ELSE 'Declining'
  END as growth_category
FROM growth_rates
WHERE population_65_plus > 1000
ORDER BY cagr_5yr DESC NULLS LAST;
```

### Seasonal Healthcare Utilization Patterns
```sql
-- Seasonal healthcare utilization analysis
WITH monthly_utilization AS (
  SELECT
    county_fips,
    EXTRACT(MONTH FROM service_date) as month,
    EXTRACT(YEAR FROM service_date) as year,
    COUNT(*) as total_visits,
    COUNT(CASE WHEN patient_age >= 65 THEN 1 END) as senior_visits,
    AVG(CASE WHEN patient_age >= 65 THEN cost_amount END) as avg_senior_cost
  FROM healthcare_utilization
  WHERE service_date >= '2022-01-01'
  GROUP BY county_fips, EXTRACT(MONTH FROM service_date), EXTRACT(YEAR FROM service_date)
),
seasonal_patterns AS (
  SELECT
    county_fips,
    month,
    AVG(total_visits) as avg_monthly_visits,
    AVG(senior_visits) as avg_monthly_senior_visits,
    AVG(avg_senior_cost) as avg_monthly_senior_cost,
    STDDEV(total_visits) as visit_volatility
  FROM monthly_utilization
  GROUP BY county_fips, month
)
SELECT
  d.state,
  d.county,
  s.month,
  CASE s.month
    WHEN 1 THEN 'January' WHEN 2 THEN 'February' WHEN 3 THEN 'March'
    WHEN 4 THEN 'April' WHEN 5 THEN 'May' WHEN 6 THEN 'June'
    WHEN 7 THEN 'July' WHEN 8 THEN 'August' WHEN 9 THEN 'September'
    WHEN 10 THEN 'October' WHEN 11 THEN 'November' WHEN 12 THEN 'December'
  END as month_name,
  ROUND(s.avg_monthly_visits, 0) as avg_visits,
  ROUND(s.avg_monthly_senior_visits, 0) as avg_senior_visits,
  ROUND(s.avg_monthly_senior_cost, 2) as avg_senior_cost,
  -- Seasonal index (compared to annual average)
  ROUND(s.avg_monthly_visits / AVG(s.avg_monthly_visits) OVER (PARTITION BY s.county_fips) * 100, 1) as seasonal_index,
  CASE
    WHEN s.month IN (12, 1, 2, 3) THEN 'Winter Peak'
    WHEN s.month IN (6, 7, 8) THEN 'Summer Low'
    ELSE 'Normal'
  END as seasonal_pattern
FROM seasonal_patterns s
JOIN demographics d ON s.county_fips = d.geo_id
WHERE d.population_65_plus > 1000
ORDER BY d.state, d.county, s.month;
```

---

*These SQL patterns provide comprehensive healthcare analytics capabilities optimized for CensusChat's demographic data and healthcare use cases.*