/**
 * Smart Query Suggestion Engine
 * Provides context-aware query recommendations
 */

import {
  QueryTemplate,
  allTemplates,
  healthcareTemplates,
  marketingTemplates,
  demographicsTemplates,
  geographicTemplates,
  getTopTemplates,
  searchTemplates
} from '../data/queryTemplates';

export interface Suggestion {
  id: string;
  text: string;
  category: QueryTemplate['category'];
  description: string;
  score: number; // Relevance score 0-1
}

export interface SuggestionContext {
  currentInput?: string;
  recentQueries?: string[];
  lastQueryCategory?: QueryTemplate['category'];
  mentionedState?: string;
  mentionedCounty?: string;
}

/**
 * US States for template variable replacement
 */
const US_STATES = [
  'California', 'Texas', 'Florida', 'New York', 'Illinois',
  'Pennsylvania', 'Ohio', 'Georgia', 'North Carolina', 'Michigan',
  'Arizona', 'Washington', 'Colorado', 'Tennessee', 'Virginia'
];

/**
 * Common counties for suggestions
 */
const COMMON_COUNTIES = [
  'Los Angeles', 'Cook', 'Harris', 'Maricopa', 'San Diego',
  'Orange', 'Miami-Dade', 'Dallas', 'Kings', 'Clark'
];

/**
 * Extract mentioned geographic entities from text
 */
function extractGeography(text: string): { state?: string; county?: string } {
  const lowerText = text.toLowerCase();

  // Check for state mentions
  let state: string | undefined;
  for (const s of US_STATES) {
    if (lowerText.includes(s.toLowerCase())) {
      state = s;
      break;
    }
  }

  // Check for county mentions
  let county: string | undefined;
  const countyMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+[Cc]ounty/);
  if (countyMatch) {
    county = countyMatch[1];
  }

  return { state, county };
}

/**
 * Detect query intent/category from text
 */
function detectCategory(text: string): QueryTemplate['category'] | null {
  const lowerText = text.toLowerCase();

  // Healthcare keywords
  const healthcareKeywords = [
    'medicare', 'medicaid', 'uninsured', 'insurance', 'disability',
    'seniors', '65+', 'elderly', 'healthcare', 'medical', 'hospital',
    'ambulatory', 'health'
  ];
  if (healthcareKeywords.some(kw => lowerText.includes(kw))) {
    return 'healthcare';
  }

  // Marketing keywords
  const marketingKeywords = [
    'income', 'affluent', 'wealthy', 'broadband', 'internet',
    'commute', 'technology', 'consumer', 'market', 'target',
    'homeowner', 'renter', 'work from home'
  ];
  if (marketingKeywords.some(kw => lowerText.includes(kw))) {
    return 'marketing';
  }

  // Demographics keywords
  const demoKeywords = [
    'population', 'age', 'race', 'ethnicity', 'education',
    'poverty', 'unemployment', 'distribution'
  ];
  if (demoKeywords.some(kw => lowerText.includes(kw))) {
    return 'demographics';
  }

  // Geographic keywords
  const geoKeywords = [
    'state', 'county', 'tract', 'block group', 'compare',
    'top 10', 'largest', 'smallest'
  ];
  if (geoKeywords.some(kw => lowerText.includes(kw))) {
    return 'geographic';
  }

  return null;
}

/**
 * Calculate relevance score for a template given context
 */
function calculateScore(template: QueryTemplate, context: SuggestionContext): number {
  let score = template.popularity / 10; // Base score from popularity

  // Boost if category matches recent query
  if (context.lastQueryCategory && template.category === context.lastQueryCategory) {
    score += 0.2;
  }

  // Boost if current input matches tags
  if (context.currentInput) {
    const inputLower = context.currentInput.toLowerCase();
    const matchingTags = template.tags.filter(tag =>
      inputLower.includes(tag) || tag.includes(inputLower)
    );
    score += matchingTags.length * 0.15;

    // Boost for query text match
    if (template.query.toLowerCase().includes(inputLower)) {
      score += 0.3;
    }
  }

  // Boost if mentioned geography can be substituted
  if (context.mentionedState && template.query.includes('{state}')) {
    score += 0.1;
  }
  if (context.mentionedCounty && template.query.includes('{county}')) {
    score += 0.1;
  }

  return Math.min(score, 1); // Cap at 1
}

/**
 * Replace template variables with actual values
 */
function fillTemplate(template: string, context: SuggestionContext): string {
  let filled = template;

  if (context.mentionedState) {
    filled = filled.replace('{state}', context.mentionedState);
  } else {
    // Use a default state
    filled = filled.replace('{state}', 'California');
  }

  if (context.mentionedCounty) {
    filled = filled.replace('{county}', context.mentionedCounty);
  } else {
    filled = filled.replace('{county}', 'Los Angeles');
  }

  return filled;
}

/**
 * Get suggestions based on context
 */
export function getSuggestions(context: SuggestionContext, limit: number = 6): Suggestion[] {
  const { currentInput } = context;

  // Extract geography from current input
  if (currentInput) {
    const geo = extractGeography(currentInput);
    context.mentionedState = context.mentionedState || geo.state;
    context.mentionedCounty = context.mentionedCounty || geo.county;
  }

  let candidates: QueryTemplate[];

  // If user is typing, search templates
  if (currentInput && currentInput.length > 2) {
    candidates = searchTemplates(currentInput);

    // Also include category-matched templates
    const detectedCategory = detectCategory(currentInput);
    if (detectedCategory) {
      const categoryTemplates = allTemplates.filter(t => t.category === detectedCategory);
      candidates = [...new Set([...candidates, ...categoryTemplates])];
    }
  } else {
    // No input - show top templates, possibly weighted by recent category
    candidates = getTopTemplates(12);

    // Boost templates from recent category
    if (context.lastQueryCategory) {
      const categoryTemplates = allTemplates.filter(t => t.category === context.lastQueryCategory);
      candidates = [...categoryTemplates.slice(0, 3), ...candidates];
    }
  }

  // Score and sort candidates
  const scored = candidates.map(template => ({
    template,
    score: calculateScore(template, context)
  }));

  scored.sort((a, b) => b.score - a.score);

  // Convert to suggestions
  const suggestions: Suggestion[] = scored.slice(0, limit).map(({ template, score }) => ({
    id: template.id,
    text: fillTemplate(template.query, context),
    category: template.category,
    description: template.description,
    score
  }));

  // Deduplicate by text
  const seen = new Set<string>();
  return suggestions.filter(s => {
    if (seen.has(s.text)) return false;
    seen.add(s.text);
    return true;
  });
}

/**
 * Get follow-up suggestions based on a completed query
 */
export function getFollowUpSuggestions(
  completedQuery: string,
  resultCategory?: QueryTemplate['category']
): Suggestion[] {
  const geo = extractGeography(completedQuery);
  const detectedCategory = resultCategory || detectCategory(completedQuery);

  const context: SuggestionContext = {
    lastQueryCategory: detectedCategory || undefined,
    mentionedState: geo.state,
    mentionedCounty: geo.county
  };

  // Get suggestions from same category and related categories
  let templates: QueryTemplate[] = [];

  if (detectedCategory === 'healthcare') {
    // Healthcare follow-ups: more healthcare + demographics
    templates = [...healthcareTemplates.slice(0, 4), ...demographicsTemplates.slice(0, 2)];
  } else if (detectedCategory === 'marketing') {
    // Marketing follow-ups: more marketing + demographics
    templates = [...marketingTemplates.slice(0, 4), ...demographicsTemplates.slice(0, 2)];
  } else {
    // General follow-ups
    templates = getTopTemplates(6);
  }

  return templates.slice(0, 4).map(t => ({
    id: t.id,
    text: fillTemplate(t.query, context),
    category: t.category,
    description: t.description,
    score: calculateScore(t, context)
  }));
}

/**
 * Get category-specific templates
 */
export function getCategorySuggestions(
  category: QueryTemplate['category'],
  context?: SuggestionContext
): Suggestion[] {
  const templates = allTemplates.filter(t => t.category === category);
  const ctx = context || {};

  return templates.slice(0, 6).map(t => ({
    id: t.id,
    text: fillTemplate(t.query, ctx),
    category: t.category,
    description: t.description,
    score: calculateScore(t, ctx)
  }));
}

/**
 * Get trending/popular suggestions
 */
export function getTrendingSuggestions(limit: number = 5): Suggestion[] {
  const top = getTopTemplates(limit);
  return top.map(t => ({
    id: t.id,
    text: t.query.replace('{state}', 'California').replace('{county}', 'Los Angeles'),
    category: t.category,
    description: t.description,
    score: t.popularity / 10
  }));
}
