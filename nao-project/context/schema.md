# CensusChat Database Schema

## Table: `county_data`

County-level demographics from the US Census Bureau. Contains 3,144 US counties and county-equivalents.

| Column | Type | Description |
|--------|------|-------------|
| `county_name` | VARCHAR | County name (e.g., "Miami-Dade County") |
| `state_name` | VARCHAR | Full state name (e.g., "Florida") |
| `population` | INTEGER | Total population count |
| `median_income` | DOUBLE | Median household income in USD |
| `poverty_rate` | DOUBLE | Percentage of population below the federal poverty line |

**Primary Key:** (`state_name`, `county_name`)

---

## Table: `block_group_data`

Block group-level demographics from ACS 5-Year Estimates. Contains 239,741 Census block groups (neighborhoods).

### Geographic Identifiers

| Column | Type | Description |
|--------|------|-------------|
| `geoid` | VARCHAR | Full GEOID (12 digits: 2 state + 3 county + 6 tract + 1 block group) |
| `state_fips` | VARCHAR | 2-digit state FIPS code (e.g., "12" for Florida) |
| `county_fips` | VARCHAR | 3-digit county FIPS code (e.g., "086" for Miami-Dade) |
| `tract_fips` | VARCHAR | 6-digit census tract code |
| `block_group` | VARCHAR | Single-digit block group number (1-9) |
| `state_name` | VARCHAR | Full state name |
| `county_name` | VARCHAR | County name |

### Demographics

| Column | Type | Description |
|--------|------|-------------|
| `population` | INTEGER | Total population |
| `median_age` | DOUBLE | Median age of residents |
| `male_population` | INTEGER | Male population count |
| `female_population` | INTEGER | Female population count |
| `under_5` | INTEGER | Population under 5 years old |
| `age_5_17` | INTEGER | Population aged 5-17 |
| `age_18_64` | INTEGER | Working-age population (18-64) |
| `age_65_plus` | INTEGER | Senior population 65 and older (Medicare eligible) |
| `age_75_plus` | INTEGER | Population 75 and older (higher healthcare utilization) |

### Race and Ethnicity

| Column | Type | Description |
|--------|------|-------------|
| `white_alone` | INTEGER | White alone population count |
| `black_alone` | INTEGER | Black or African American alone population count |
| `asian_alone` | INTEGER | Asian alone population count |
| `hispanic_latino` | INTEGER | Hispanic or Latino population count (any race) |

### Economics

| Column | Type | Description |
|--------|------|-------------|
| `median_household_income` | DOUBLE | Median household income in USD |
| `per_capita_income` | DOUBLE | Per capita income in USD |
| `poverty_rate` | DOUBLE | Percentage below federal poverty line |
| `unemployment_rate` | DOUBLE | Unemployment rate percentage |

### Healthcare Access

| Column | Type | Description |
|--------|------|-------------|
| `uninsured_rate` | DOUBLE | Percentage of population without health insurance |
| `disability_rate` | DOUBLE | Percentage of population with a disability |

### Education

| Column | Type | Description |
|--------|------|-------------|
| `high_school_or_higher_pct` | DOUBLE | Percentage with high school diploma or higher |
| `bachelors_or_higher_pct` | DOUBLE | Percentage with bachelor's degree or higher |

### Housing

| Column | Type | Description |
|--------|------|-------------|
| `total_housing_units` | INTEGER | Total number of housing units |
| `median_home_value` | DOUBLE | Median home value in USD |
| `median_rent` | DOUBLE | Median gross rent in USD |
| `renter_occupied_pct` | DOUBLE | Percentage of housing units that are renter-occupied |

### Access and Transportation

| Column | Type | Description |
|--------|------|-------------|
| `limited_english_pct` | DOUBLE | Percentage with limited English proficiency |
| `no_vehicle_pct` | DOUBLE | Percentage of households with no vehicle |
| `public_transit_pct` | DOUBLE | Percentage commuting by public transit |

**Primary Key:** (`geoid`)

---

## Table: `block_group_data_expanded`

Expanded block group data with 84 variables per block group. Contains all columns from `block_group_data` plus additional detail columns. Covers 239,741 neighborhoods.

### Additional Income Band Columns

| Column | Type | Description |
|--------|------|-------------|
| `income_less_10k` | INTEGER | Households with income under $10,000 |
| `income_10_to_25k` | INTEGER | Households with income $10,000-$24,999 |
| `income_25_to_50k` | INTEGER | Households with income $25,000-$49,999 |
| `income_50_to_75k` | INTEGER | Households with income $50,000-$74,999 |
| `income_75_to_100k` | INTEGER | Households with income $75,000-$99,999 |
| `income_100_to_150k` | INTEGER | Households with income $100,000-$149,999 |
| `income_150_to_200k` | INTEGER | Households with income $150,000-$199,999 |
| `income_200k_plus` | INTEGER | Households with income $200,000 or more |

### Income Sources

| Column | Type | Description |
|--------|------|-------------|
| `public_assistance_income` | INTEGER | Households receiving public assistance income |
| `snap_benefits` | INTEGER | Households receiving SNAP (food stamp) benefits |
| `retirement_income` | INTEGER | Households receiving retirement income |
| `self_employment_earnings` | INTEGER | Households with self-employment earnings |

### Detailed Education

| Column | Type | Description |
|--------|------|-------------|
| `some_high_school_pct` | DOUBLE | Percentage with some high school (no diploma) |
| `high_school_grad_pct` | DOUBLE | Percentage with high school diploma only |
| `some_college_pct` | DOUBLE | Percentage with some college or associate's degree |
| `bachelors_plus_pct` | DOUBLE | Percentage with bachelor's degree or higher |

### Detailed Housing

| Column | Type | Description |
|--------|------|-------------|
| `vacant_units` | INTEGER | Number of vacant housing units |
| `rent_burden_50pct` | DOUBLE | Percentage of renters paying 50%+ of income on rent (severe rent burden) |
| `crowded_housing` | DOUBLE | Percentage of units with more than 1 person per room |
| `single_family_homes` | INTEGER | Number of single-family detached homes |
| `mobile_homes` | INTEGER | Number of mobile homes/manufactured housing |
| `median_year_built` | INTEGER | Median year housing structures were built |

### Technology Access

| Column | Type | Description |
|--------|------|-------------|
| `with_computer_pct` | DOUBLE | Percentage of households with a computer |
| `with_broadband_pct` | DOUBLE | Percentage of households with broadband internet |
| `no_internet_pct` | DOUBLE | Percentage of households with no internet access |

### Commute and Transportation

| Column | Type | Description |
|--------|------|-------------|
| `commute_under_10_min` | DOUBLE | Percentage with commute under 10 minutes |
| `commute_10_to_19_min` | DOUBLE | Percentage with 10-19 minute commute |
| `commute_20_to_29_min` | DOUBLE | Percentage with 20-29 minute commute |
| `commute_30_to_44_min` | DOUBLE | Percentage with 30-44 minute commute |
| `commute_45_plus_min` | DOUBLE | Percentage with 45+ minute commute |
| `work_from_home` | DOUBLE | Percentage working from home |
| `public_transit_pct` | DOUBLE | Percentage commuting by public transit |
| `no_vehicle_transit_pct` | DOUBLE | Percentage of households with no vehicle available |

### Occupation

| Column | Type | Description |
|--------|------|-------------|
| `management_occupations_pct` | DOUBLE | Percentage in management, business, science, and arts occupations |
| `healthcare_occupations_pct` | DOUBLE | Percentage employed in healthcare occupations |
| `retail_sales_pct` | DOUBLE | Percentage in retail and sales occupations |

### Detailed Healthcare

| Column | Type | Description |
|--------|------|-------------|
| `uninsured_rate` | DOUBLE | Overall uninsured rate |
| `uninsured_under_19` | DOUBLE | Uninsured rate for population under 19 |
| `uninsured_19_to_64` | DOUBLE | Uninsured rate for working-age adults (19-64) |
| `uninsured_65_plus` | DOUBLE | Uninsured rate for seniors 65+ |
| `disability_rate` | DOUBLE | Overall disability rate |
| `ambulatory_difficulty_pct` | DOUBLE | Percentage with ambulatory (walking) difficulty |
| `independent_living_difficulty_pct` | DOUBLE | Percentage with independent living difficulty |

### Language

| Column | Type | Description |
|--------|------|-------------|
| `limited_english_pct` | DOUBLE | Overall limited English proficiency rate |
| `spanish_limited_english_pct` | DOUBLE | Spanish speakers with limited English |
| `asian_limited_english_pct` | DOUBLE | Asian language speakers with limited English |

### Family Structure

| Column | Type | Description |
|--------|------|-------------|
| `children_with_2_parents_pct` | DOUBLE | Percentage of children living with two parents |
| `children_single_parent_pct` | DOUBLE | Percentage of children in single-parent households |
| `single_person_households_pct` | DOUBLE | Percentage of single-person households |
| `seniors_living_alone_pct` | DOUBLE | Percentage of seniors (65+) living alone |
| `grandparents_responsible_pct` | DOUBLE | Percentage of grandparents responsible for grandchildren |

**Primary Key:** (`geoid`)
