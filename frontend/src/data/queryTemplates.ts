/**
 * Query Templates for Smart Suggestions
 * Organized by category with context-aware triggers
 */

export interface QueryTemplate {
  id: string;
  query: string;
  category: 'healthcare' | 'marketing' | 'demographics' | 'geographic';
  tags: string[];
  description: string;
  popularity: number; // 1-10 for ranking
}

/**
 * Healthcare-focused query templates
 */
export const healthcareTemplates: QueryTemplate[] = [
  // Medicare & Seniors
  {
    id: 'hc-medicare-seniors',
    query: 'Show me Medicare eligible seniors (65+) by county in {state}',
    category: 'healthcare',
    tags: ['medicare', 'seniors', '65+', 'elderly', 'retirement'],
    description: 'Find Medicare-eligible population concentrations',
    popularity: 10
  },
  {
    id: 'hc-seniors-living-alone',
    query: 'Counties with highest percentage of seniors living alone',
    category: 'healthcare',
    tags: ['seniors', 'alone', 'isolated', 'elderly care'],
    description: 'Identify isolated senior populations needing outreach',
    popularity: 8
  },
  {
    id: 'hc-disability-rate',
    query: 'Areas with high disability rates in {state}',
    category: 'healthcare',
    tags: ['disability', 'accessibility', 'ada', 'mobility'],
    description: 'Find communities with accessibility needs',
    popularity: 7
  },
  // Insurance & Coverage
  {
    id: 'hc-uninsured-adults',
    query: 'Uninsured working-age adults (19-64) by county',
    category: 'healthcare',
    tags: ['uninsured', 'coverage', 'insurance', 'gap'],
    description: 'Identify insurance coverage gaps',
    popularity: 9
  },
  {
    id: 'hc-uninsured-children',
    query: 'Counties with highest uninsured children rates',
    category: 'healthcare',
    tags: ['uninsured', 'children', 'pediatric', 'kids'],
    description: 'Find areas needing pediatric coverage outreach',
    popularity: 8
  },
  // SDOH
  {
    id: 'hc-poverty-health',
    query: 'Counties with high poverty and low insurance rates',
    category: 'healthcare',
    tags: ['poverty', 'sdoh', 'social determinants', 'underserved'],
    description: 'Social determinants of health analysis',
    popularity: 9
  },
  {
    id: 'hc-limited-english',
    query: 'Areas with limited English proficiency and healthcare access needs',
    category: 'healthcare',
    tags: ['language', 'english', 'translation', 'access'],
    description: 'Identify language barrier populations',
    popularity: 7
  },
  {
    id: 'hc-no-vehicle',
    query: 'Counties where households lack vehicles and have high senior populations',
    category: 'healthcare',
    tags: ['transportation', 'vehicle', 'access', 'mobility'],
    description: 'Transportation barriers to healthcare',
    popularity: 6
  },
  // Healthcare Workers
  {
    id: 'hc-healthcare-workers',
    query: 'Counties with highest concentration of healthcare workers',
    category: 'healthcare',
    tags: ['healthcare workers', 'medical', 'nursing', 'employment'],
    description: 'Find healthcare workforce concentrations',
    popularity: 7
  },
  {
    id: 'hc-ambulatory-difficulty',
    query: 'Populations with ambulatory difficulty by county in {state}',
    category: 'healthcare',
    tags: ['ambulatory', 'walking', 'mobility', 'disability'],
    description: 'Mobility-impaired population analysis',
    popularity: 6
  }
];

/**
 * Marketing analytics query templates
 */
export const marketingTemplates: QueryTemplate[] = [
  // Income Segmentation
  {
    id: 'mkt-affluent-areas',
    query: 'Affluent neighborhoods with household income over $150k in {state}',
    category: 'marketing',
    tags: ['affluent', 'wealthy', 'high income', 'luxury'],
    description: 'Target high-income consumer segments',
    popularity: 10
  },
  {
    id: 'mkt-income-distribution',
    query: 'Income distribution by bracket in {county} County',
    category: 'marketing',
    tags: ['income', 'distribution', 'brackets', 'segments'],
    description: 'Analyze income segments for targeting',
    popularity: 8
  },
  {
    id: 'mkt-middle-class',
    query: 'Middle-income households ($50k-$100k) by county',
    category: 'marketing',
    tags: ['middle class', 'income', 'mainstream'],
    description: 'Find middle-market consumer concentrations',
    popularity: 7
  },
  // Technology & Digital
  {
    id: 'mkt-broadband',
    query: 'Areas with high broadband adoption rates',
    category: 'marketing',
    tags: ['broadband', 'internet', 'digital', 'technology'],
    description: 'Digital-ready markets for e-commerce',
    popularity: 9
  },
  {
    id: 'mkt-no-internet',
    query: 'Counties with low internet access rates',
    category: 'marketing',
    tags: ['digital divide', 'no internet', 'offline'],
    description: 'Identify traditional marketing targets',
    popularity: 6
  },
  {
    id: 'mkt-tech-adoption',
    query: 'High technology adoption areas (computer + broadband)',
    category: 'marketing',
    tags: ['technology', 'computer', 'digital', 'tech-savvy'],
    description: 'Tech-forward consumer segments',
    popularity: 8
  },
  // Commuting & Lifestyle
  {
    id: 'mkt-long-commuters',
    query: 'Areas with long commute times (45+ minutes)',
    category: 'marketing',
    tags: ['commute', 'commuters', 'drive time', 'podcast'],
    description: 'Target commuters for audio/podcast ads',
    popularity: 7
  },
  {
    id: 'mkt-work-from-home',
    query: 'Counties with highest work from home rates',
    category: 'marketing',
    tags: ['remote work', 'wfh', 'home office', 'telecommute'],
    description: 'Remote worker concentrations',
    popularity: 9
  },
  {
    id: 'mkt-public-transit',
    query: 'Areas with high public transit usage',
    category: 'marketing',
    tags: ['transit', 'public transportation', 'urban'],
    description: 'Urban transit advertising opportunities',
    popularity: 6
  },
  // Family & Housing
  {
    id: 'mkt-young-families',
    query: 'Counties with high concentration of families with children',
    category: 'marketing',
    tags: ['families', 'children', 'parents', 'kids'],
    description: 'Family-oriented market segments',
    popularity: 8
  },
  {
    id: 'mkt-homeowners',
    query: 'Areas with high homeownership and home values over $500k',
    category: 'marketing',
    tags: ['homeowners', 'real estate', 'property'],
    description: 'Premium homeowner markets',
    popularity: 7
  },
  {
    id: 'mkt-renters',
    query: 'High renter concentration areas in {state}',
    category: 'marketing',
    tags: ['renters', 'apartments', 'rental'],
    description: 'Renter market opportunities',
    popularity: 6
  }
];

/**
 * Demographics query templates
 */
export const demographicsTemplates: QueryTemplate[] = [
  {
    id: 'demo-population',
    query: 'Population by county in {state}',
    category: 'demographics',
    tags: ['population', 'count', 'size'],
    description: 'Basic population counts',
    popularity: 10
  },
  {
    id: 'demo-age-distribution',
    query: 'Age distribution across counties in {state}',
    category: 'demographics',
    tags: ['age', 'distribution', 'generations'],
    description: 'Generational breakdowns',
    popularity: 9
  },
  {
    id: 'demo-race-ethnicity',
    query: 'Racial and ethnic composition by county',
    category: 'demographics',
    tags: ['race', 'ethnicity', 'diversity'],
    description: 'Diversity analysis',
    popularity: 8
  },
  {
    id: 'demo-education',
    query: 'Education attainment levels by county in {state}',
    category: 'demographics',
    tags: ['education', 'college', 'degree', 'school'],
    description: 'Educational attainment analysis',
    popularity: 8
  },
  {
    id: 'demo-poverty',
    query: 'Poverty rates by county',
    category: 'demographics',
    tags: ['poverty', 'low income', 'economic'],
    description: 'Economic hardship analysis',
    popularity: 7
  },
  {
    id: 'demo-unemployment',
    query: 'Unemployment rates across {state}',
    category: 'demographics',
    tags: ['unemployment', 'jobs', 'employment'],
    description: 'Labor market analysis',
    popularity: 7
  }
];

/**
 * Geographic query templates
 */
export const geographicTemplates: QueryTemplate[] = [
  {
    id: 'geo-state-compare',
    query: 'Compare all states by median household income',
    category: 'geographic',
    tags: ['states', 'compare', 'national'],
    description: 'State-level comparisons',
    popularity: 9
  },
  {
    id: 'geo-county-top',
    query: 'Top 10 counties by population in {state}',
    category: 'geographic',
    tags: ['counties', 'largest', 'top'],
    description: 'Largest county analysis',
    popularity: 8
  },
  {
    id: 'geo-tract-detail',
    query: 'Census tracts in {county} County with details',
    category: 'geographic',
    tags: ['tracts', 'detailed', 'granular'],
    description: 'Tract-level granularity',
    popularity: 6
  },
  {
    id: 'geo-block-groups',
    query: 'Block groups in {county} County, {state}',
    category: 'geographic',
    tags: ['block groups', 'neighborhood', 'hyperlocal'],
    description: 'Neighborhood-level detail',
    popularity: 5
  }
];

/**
 * All templates combined
 */
export const allTemplates: QueryTemplate[] = [
  ...healthcareTemplates,
  ...marketingTemplates,
  ...demographicsTemplates,
  ...geographicTemplates
];

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: QueryTemplate['category']): QueryTemplate[] {
  return allTemplates.filter(t => t.category === category);
}

/**
 * Get top templates by popularity
 */
export function getTopTemplates(limit: number = 5): QueryTemplate[] {
  return [...allTemplates]
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, limit);
}

/**
 * Search templates by text
 */
export function searchTemplates(searchText: string): QueryTemplate[] {
  const lower = searchText.toLowerCase();
  return allTemplates.filter(t =>
    t.query.toLowerCase().includes(lower) ||
    t.tags.some(tag => tag.toLowerCase().includes(lower)) ||
    t.description.toLowerCase().includes(lower)
  );
}
