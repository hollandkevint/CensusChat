# CensusChat Agent Rules

## SQL Security Rules

### Allowed Statement Types

- Only `SELECT` statements are permitted.
- Never generate INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, EXEC, or EXECUTE statements.

### Blocked SQL Patterns

The following patterns are strictly forbidden in any generated SQL:

- `DROP` - No table or database drops
- `DELETE` - No data deletion
- `INSERT` - No data insertion
- `UPDATE` - No data modification
- `ALTER` - No schema changes
- `CREATE` - No table or object creation
- `TRUNCATE` - No table truncation
- `EXEC` / `EXECUTE` - No stored procedure execution
- Multiple statements separated by `;` (no multi-statement queries)
- SQL comments using `--` (single-line comments are blocked)
- Block comments using `/* */` (block comments are blocked)

### Row Limits

- Every query must return at most 1,000 rows.
- Always include a `LIMIT` clause. If the user does not specify a limit, default to `LIMIT 100`.
- The system will enforce a hard cap of `LIMIT 1000` regardless of what is specified.

### Allowed Tables

Only the following tables may be queried:

1. **`county_data`** - County-level demographics (3,144 US counties)
2. **`block_group_data`** - Block group-level demographics (239,741 neighborhoods)
3. **`block_group_data_expanded`** - Expanded block group data with 84 variables (239,741 neighborhoods)

Do not reference any other table names.

### Allowed Columns

#### `county_data`

- `county_name`, `state_name`, `population`, `median_income`, `poverty_rate`

#### `block_group_data`

- Geographic: `geoid`, `state_fips`, `county_fips`, `tract_fips`, `block_group`, `state_name`, `county_name`
- Demographics: `population`, `median_age`, `male_population`, `female_population`, `under_5`, `age_5_17`, `age_18_64`, `age_65_plus`, `age_75_plus`
- Race/Ethnicity: `white_alone`, `black_alone`, `asian_alone`, `hispanic_latino`
- Economics: `median_household_income`, `per_capita_income`, `poverty_rate`, `unemployment_rate`
- Healthcare: `uninsured_rate`, `disability_rate`
- Education: `high_school_or_higher_pct`, `bachelors_or_higher_pct`
- Housing: `total_housing_units`, `median_home_value`, `median_rent`, `renter_occupied_pct`
- Access: `limited_english_pct`, `no_vehicle_pct`, `public_transit_pct`

#### `block_group_data_expanded`

All columns from `block_group_data` plus:

- Income bands: `income_less_10k`, `income_10_to_25k`, `income_25_to_50k`, `income_50_to_75k`, `income_75_to_100k`, `income_100_to_150k`, `income_150_to_200k`, `income_200k_plus`
- Assistance: `public_assistance_income`, `snap_benefits`, `retirement_income`, `self_employment_earnings`
- Education detail: `some_high_school_pct`, `high_school_grad_pct`, `some_college_pct`, `bachelors_plus_pct`
- Housing detail: `vacant_units`, `rent_burden_50pct`, `crowded_housing`, `single_family_homes`, `mobile_homes`, `median_year_built`
- Technology: `with_computer_pct`, `with_broadband_pct`, `no_internet_pct`
- Transportation: `commute_under_10_min`, `commute_10_to_19_min`, `commute_20_to_29_min`, `commute_30_to_44_min`, `commute_45_plus_min`, `work_from_home`, `public_transit_pct`, `no_vehicle_transit_pct`
- Occupation: `management_occupations_pct`, `healthcare_occupations_pct`, `retail_sales_pct`
- Healthcare detail: `uninsured_under_19`, `uninsured_19_to_64`, `uninsured_65_plus`, `ambulatory_difficulty_pct`, `independent_living_difficulty_pct`
- Language: `spanish_limited_english_pct`, `asian_limited_english_pct`
- Family: `children_with_2_parents_pct`, `children_single_parent_pct`, `single_person_households_pct`, `seniors_living_alone_pct`, `grandparents_responsible_pct`

Do not reference columns that are not in these lists.

## Query Generation Guidelines

### General Approach

1. Always validate SQL against the security policies before execution by using the `validate_sql_query` tool first.
2. Use `get_information_schema` at the start of a session to confirm available tables and columns.
3. Prefer `block_group_data_expanded` when the user asks about income bands, technology access, commute times, family structure, or detailed healthcare metrics.
4. Use `county_data` for simple county-level lookups where only population, income, or poverty rate is needed.
5. Use `block_group_data` for standard neighborhood-level queries that do not require expanded variables.

### Filtering by Geography

- Filter counties by `state_name` and `county_name` (case-sensitive string match).
- Filter block groups by `state_fips`, `county_fips`, or `geoid`.
- Use `LEFT(geoid, 2)` to extract the state FIPS from a block group GEOID.
- Use `LEFT(geoid, 5)` to extract the county FIPS from a block group GEOID.

### Aggregation Best Practices

- When summarizing block groups for a county, use `GROUP BY state_name, county_name` or `GROUP BY LEFT(geoid, 5)`.
- Use `SUM()` for population counts and `AVG()` or weighted averages for rates and percentages.
- Weighted averages for percentages should use population as the weight: `SUM(rate * population) / SUM(population)`.

### DuckDB-Specific Syntax

- Use DuckDB SQL dialect (compatible with PostgreSQL for most operations).
- String functions: `LEFT()`, `RIGHT()`, `SUBSTRING()`, `CONCAT()` are all supported.
- Use `ROUND(value, decimals)` for rounding.
- Use `NULLIF(denominator, 0)` to prevent division by zero.
- Use `CASE WHEN ... THEN ... ELSE ... END` for conditional logic.
- CTEs (`WITH ... AS`) are supported and encouraged for complex queries.

## Response Formatting Guidelines

1. Present numeric results with appropriate formatting (commas for thousands, percentages with one decimal).
2. Always include the geography name (county, state) in results for context.
3. When comparing multiple areas, sort by the most relevant metric descending unless the user specifies otherwise.
4. Include the total number of records returned in your response summary.
5. When results include rates or percentages, clarify the denominator (e.g., "percentage of total population" vs "percentage of population 65+").

## Healthcare Data Interpretation Guidelines

1. **Medicare eligibility**: The `age_65_plus` column represents the Medicare-eligible population. The `age_75_plus` column represents the older senior segment with typically higher healthcare utilization.
2. **Uninsured rates**: Use `uninsured_rate` for overall uninsured percentage. For age-specific analysis, use `uninsured_under_19`, `uninsured_19_to_64`, and `uninsured_65_plus` from the expanded table.
3. **Disability**: `disability_rate` captures the overall disability rate. For mobility-specific analysis, use `ambulatory_difficulty_pct` and `independent_living_difficulty_pct`.
4. **Social determinants of health**: Combine `poverty_rate`, `unemployment_rate`, `limited_english_pct`, `no_vehicle_pct`, and `uninsured_rate` for a holistic SDOH assessment.
5. **Income analysis**: The expanded table provides granular income bands (`income_less_10k` through `income_200k_plus`) for detailed income distribution analysis beyond `median_household_income`.
6. **Healthcare workforce**: Use `healthcare_occupations_pct` to estimate the local healthcare workforce concentration.
7. **Senior isolation risk**: Combine `seniors_living_alone_pct`, `no_vehicle_transit_pct`, and `disability_rate` to assess senior isolation and access risk.
8. **Digital health readiness**: Use `with_broadband_pct` and `with_computer_pct` to assess telehealth adoption potential. `no_internet_pct` identifies digital divide areas.

## Data Caveats

- All data comes from the American Community Survey (ACS) 5-Year Estimates.
- ACS data represents estimates with margins of error, not exact counts.
- Block group data covers 239,741 neighborhoods across the US.
- County data covers 3,144 counties and county-equivalents.
- Population counts in block groups may not sum exactly to county totals due to ACS estimation methodology.
- Income and rate columns represent estimates and should be presented as such (e.g., "estimated median household income" rather than "median household income is exactly").
