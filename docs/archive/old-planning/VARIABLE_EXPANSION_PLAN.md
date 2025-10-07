# ACS Block Group Variable Expansion Plan

## Current Status
**Loaded:** 29 variables across 6 categories
**Coverage:** 239,741 block groups

## Research Findings - Additional SDOH Variables Available

### Priority 1: Healthcare Access (HIGH IMPACT)
These directly measure healthcare access and should be added immediately:

| Variable Code | Description | Why Important |
|---------------|-------------|---------------|
| **B27010_001E** | Health insurance coverage total | Denominator for insurance calculations |
| **B27010_017E** | Uninsured under 19 | Pediatric insurance gap |
| **B27010_033E** | Uninsured 19-64 | Working-age insurance gap |
| **B27010_050E** | Uninsured 65+ | Medicare gap population |
| **B18135_001E** | Disability total (better denominator) | More accurate disability rates |
| **B18135_011E** | With ambulatory difficulty | Mobility barriers to care |
| **B18135_016E** | With independent living difficulty | Need for home health services |

### Priority 2: Housing Security (MEDIUM-HIGH IMPACT)
Critical for SDOH analysis:

| Variable Code | Description | Why Important |
|---------------|-------------|---------------|
| **B25070_001E** | Gross rent total | Denominator for housing burden |
| **B25070_010E** | Rent 50%+ of income | Severe housing cost burden |
| **B25070_011E** | Rent not computed | Unstable housing indicator |
| **B25014_005E** | Crowded housing (>1.5 per room) | Health risk factor |
| **B25014_011E** | Severely crowded (>2 per room) | High health risk |
| **B25024_002E** | Single-family detached homes | Housing type for outbreak analysis |
| **B25024_010E** | Mobile homes | Vulnerable housing type |

### Priority 3: Economic Security (MEDIUM IMPACT)
Expand beyond poverty rate:

| Variable Code | Description | Why Important |
|---------------|-------------|---------------|
| **B19001_002E** | Income <$10k | Extreme poverty |
| **B19001_003E** | Income $10k-$15k | Very low income |
| **B19001_011E** | Income $50k-$60k | Middle income threshold |
| **B19001_014E** | Income $100k-$125k | Higher income |
| **B19001_017E** | Income $200k+ | Highest income |
| **B19057_002E** | Public assistance income | Government support dependency |
| **B19058_002E** | SNAP/Food Stamps | Food insecurity proxy |

### Priority 4: Transportation Barriers (MEDIUM IMPACT)
Already have some, expand for completeness:

| Variable Code | Description | Why Important |
|---------------|-------------|---------------|
| **B08303_008E** | Commute 30-34 mins | Moderate access barrier |
| **B08303_012E** | Commute 60+ mins | Severe access barrier |
| **B08303_013E** | Work from home | Healthcare access advantage |
| **B08134_061E** | No vehicle, public transit | Transportation dependency |
| **B08134_071E** | No vehicle, walked | Limited mobility |
| **B08134_081E** | No vehicle, other means | Non-standard transport |

### Priority 5: Social Support (LOW-MEDIUM IMPACT)
Family structure and social networks:

| Variable Code | Description | Why Important |
|---------------|-------------|---------------|
| **B09001_002E** | Children in families | Pediatric care demand |
| **B09001_003E** | Children living with 2 parents | Family stability |
| **B09001_004E** | Children single parent | Higher health risk |
| **B11001_006E** | Single-person households | Social isolation risk |
| **B11001_007E** | Households 65+ living alone | Senior isolation |
| **B11007_002E** | Grandparents responsible for grandchildren | Caregiver burden |

### Priority 6: Language & Cultural Access (LOW-MEDIUM IMPACT)
Already have limited English, expand:

| Variable Code | Description | Why Important |
|---------------|-------------|---------------|
| **B16005_007E** | Spanish speakers, limited English | Language barrier specificity |
| **B16005_012E** | Asian language speakers, limited English | Language barrier specificity |
| **B16005_002E** | English only | No language barrier |
| **C16002_004E** | Spanish at home | Cultural considerations |
| **C16002_007E** | Asian/Pacific Islander language | Cultural considerations |

## Recommended Expansion Strategy

### Phase 1: Critical Healthcare Variables (Add 14 variables)
**Timeline:** Immediate
**Effort:** 2-3 hours reload

Add these essential health access variables:
- Health insurance detailed (B27010 series) - 4 variables
- Disability detailed (B18135 series) - 3 variables
- Housing burden (B25070 series) - 3 variables
- Housing crowding (B25014 series) - 2 variables
- SNAP/Food assistance (B19058) - 1 variable
- Public assistance (B19057) - 1 variable

**New Total:** 43 variables per block group

### Phase 2: Economic & Transportation (Add 10 variables)
**Timeline:** Within 1 week
**Effort:** 2-3 hours reload

Add economic detail and transportation barriers:
- Income distribution (B19001 series) - 5 variables
- Commute time (B08303 series) - 3 variables
- Vehicle/transit detail (B08134 series) - 2 variables

**New Total:** 53 variables per block group

### Phase 3: Social Support (Add 8 variables)
**Timeline:** As needed
**Effort:** 2-3 hours reload

Add family structure and isolation indicators:
- Children in families (B09001 series) - 3 variables
- Household composition (B11001 series) - 3 variables
- Grandparent caregivers (B11007) - 2 variables

**New Total:** 61 variables per block group

### Phase 4: Language Specificity (Add 7 variables)
**Timeline:** Optional/future
**Effort:** 2-3 hours reload

Add specific language groups for targeted outreach:
- Language-specific barriers (B16005 series) - 4 variables
- Language at home (C16002 series) - 3 variables

**New Total:** 68 variables per block group

## Implementation Checklist

### For Each Phase:
- [ ] Update `ACS_VARIABLES` in `/backend/scripts/load-acs-blockgroup.ts`
- [ ] Update interface `BlockGroupData` with new fields
- [ ] Update `createTable()` SQL schema
- [ ] Update `insertBlockGroups()` INSERT statement
- [ ] Update data parsing logic in `fetchBlockGroupData()`
- [ ] Test with DC (571 block groups)
- [ ] Run full load (239,741 block groups, 2-4 hours)
- [ ] Update `/backend/src/validation/sqlSecurityPolicies.ts` allowlist
- [ ] Update `/backend/src/services/anthropicService.ts` Claude prompt
- [ ] Update `/docs/guides/BLOCK_GROUP_VARIABLES.md` documentation
- [ ] Update quickstart guide

## Census API Considerations

### Variable Limits
- Current: 29 variables ✅ (works fine)
- Phase 1: 43 variables (should work, test with DC first)
- Phase 2: 53 variables (may need batching)
- Phase 3: 61 variables (likely needs batching)
- Phase 4: 68 variables (definitely needs batching)

### Batching Strategy (if needed for >50 variables)
```typescript
// Split into 2 API calls of ~35 variables each
const batch1 = [...demographics, ...health, ...housing]; // 35 vars
const batch2 = [...economic, ...transport, ...social]; // 33 vars

// Merge results by GEOID
const merged = mergeBatches(batch1, batch2);
```

## Data Quality Notes

### Variables with Potential NULLs
- Insurance variables (B27010): May be NULL for group quarters
- SNAP/assistance (B19058, B19057): May be NULL if not applicable
- Crowding (B25014): May be NULL for vacant units
- Commute (B08303): NULL for unemployed/work from home

### Handling Strategy
```typescript
const parseNumSafe = (key: string, defaultValue = 0): number => {
  const val = parseInt(dataMap[key] || String(defaultValue));
  return isNaN(val) ? defaultValue : val;
};
```

## Expected Impact

### Phase 1 (43 variables)
- ✅ Detailed insurance gap analysis by age
- ✅ Specific disability types for care planning
- ✅ Housing cost burden identification
- ✅ Food/economic insecurity detection

### Phase 2 (53 variables)
- ✅ Income distribution analysis beyond poverty
- ✅ Transportation barrier quantification
- ✅ Access difficulty scoring

### Phase 3 (61 variables)
- ✅ Family structure health risk analysis
- ✅ Social isolation detection (seniors living alone)
- ✅ Caregiver burden identification

### Phase 4 (68 variables)
- ✅ Targeted multilingual outreach
- ✅ Cultural competency planning
- ✅ Language-specific service needs

## Recommendation

**Start with Phase 1 (43 variables)** - adds the most impactful healthcare and SDOH variables with minimal complexity.

**Test thoroughly with DC** (571 block groups) before running full load.

**Monitor API performance** - if Phase 1 works well, proceed to Phase 2.

---

*Research completed: October 2025*
*Based on: ACS 2023 5-Year variables, AHRQ SDOH framework, CDC PLACES metrics*
