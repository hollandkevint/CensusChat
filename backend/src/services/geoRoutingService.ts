/**
 * Geographic Routing Service
 *
 * Intelligently routes queries to the appropriate geographic level based on:
 * - Query specificity (state name, county mention, etc.)
 * - Population estimates
 * - Performance considerations
 *
 * Geographic Hierarchy:
 * - State (51): Fastest, least granular
 * - County (3,144): Fast, moderate granularity
 * - Tract (73,000): Moderate speed, high granularity
 * - Block Group (240,000): Slowest, highest granularity
 */

export type GeoLevel = 'state' | 'county' | 'tract' | 'block_group';

export interface GeoRoutingDecision {
  level: GeoLevel;
  table: string;
  reasoning: string;
  estimatedRows: number;
}

export interface QueryIntent {
  mentionsState?: string;
  mentionsCounty?: string;
  mentionsTract?: boolean;
  estimatedPopulation?: number;
  requiresHighGranularity?: boolean;
  hasGeographicFilter?: boolean;
}

/**
 * Determine optimal geographic level for a query
 */
export function determineGeoLevel(intent: QueryIntent): GeoRoutingDecision {
  // Priority 1: Explicit geographic mentions
  if (intent.mentionsTract) {
    return {
      level: 'tract',
      table: 'tract_data',
      reasoning: 'Query explicitly mentions census tracts',
      estimatedRows: 73000
    };
  }

  if (intent.mentionsCounty && intent.mentionsState) {
    // Specific county requested
    return {
      level: 'block_group',
      table: 'block_group_data_expanded',
      reasoning: 'Specific county requested - using highest granularity',
      estimatedRows: 100 // avg block groups per county
    };
  }

  if (intent.mentionsCounty) {
    return {
      level: 'county',
      table: 'county_data',
      reasoning: 'County-level query',
      estimatedRows: 1
    };
  }

  if (intent.mentionsState && !intent.requiresHighGranularity) {
    return {
      level: 'state',
      table: 'state_data',
      reasoning: 'State-level summary requested',
      estimatedRows: 1
    };
  }

  // Priority 2: Population-based routing
  if (intent.estimatedPopulation) {
    if (intent.estimatedPopulation > 5000000) {
      return {
        level: 'state',
        table: 'state_data',
        reasoning: 'Large population (>5M) - state level appropriate',
        estimatedRows: 5
      };
    }

    if (intent.estimatedPopulation > 500000) {
      return {
        level: 'county',
        table: 'county_data',
        reasoning: 'Medium population (500K-5M) - county level',
        estimatedRows: 20
      };
    }

    if (intent.estimatedPopulation > 50000) {
      return {
        level: 'tract',
        table: 'tract_data',
        reasoning: 'Smaller population (50K-500K) - tract level',
        estimatedRows: 100
      };
    }

    // Small population - use block groups
    return {
      level: 'block_group',
      table: 'block_group_data_expanded',
      reasoning: 'Small population (<50K) - block group granularity',
      estimatedRows: 50
    };
  }

  // Priority 3: High granularity requirements
  if (intent.requiresHighGranularity) {
    return {
      level: 'block_group',
      table: 'block_group_data_expanded',
      reasoning: 'High granularity analysis required',
      estimatedRows: 1000
    };
  }

  // Priority 4: Has geographic filter
  if (intent.hasGeographicFilter) {
    return {
      level: 'tract',
      table: 'tract_data',
      reasoning: 'Geographic filtering present - using tract level for balance',
      estimatedRows: 500
    };
  }

  // Default: County level (good balance)
  return {
    level: 'county',
    table: 'county_data',
    reasoning: 'Default routing - county level provides good balance',
    estimatedRows: 3144
  };
}

/**
 * Parse query text to extract geographic intent
 */
export function parseQueryIntent(queryText: string): QueryIntent {
  const lowerQuery = queryText.toLowerCase();

  // State detection
  const statePatterns = [
    /\b(california|texas|florida|new york|illinois|pennsylvania|ohio|georgia|north carolina|michigan)\b/i,
    /\b(california|texas|florida|ny|il|pa|oh|ga|nc|mi)\b/i, // abbreviations
    /in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+state/i,
    /state\s+of\s+([A-Z][a-z]+)/i
  ];

  let mentionsState: string | undefined;
  for (const pattern of statePatterns) {
    const match = queryText.match(pattern);
    if (match) {
      mentionsState = match[1];
      break;
    }
  }

  // County detection
  const countyPatterns = [
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+county/i,
    /in\s+([A-Z][a-z]+)\s+county/i,
    /county\s+of\s+([A-Z][a-z]+)/i
  ];

  let mentionsCounty: string | undefined;
  for (const pattern of countyPatterns) {
    const match = queryText.match(pattern);
    if (match) {
      mentionsCounty = match[1];
      break;
    }
  }

  // Tract detection
  const mentionsTract = /\b(tract|census tract|tracts)\b/i.test(queryText);

  // Population estimation from query keywords
  let estimatedPopulation: number | undefined;
  if (/\b(million|millions|statewide|entire state)\b/i.test(queryText)) {
    estimatedPopulation = 5000000;
  } else if (/\b(hundreds of thousands|major city|large county)\b/i.test(queryText)) {
    estimatedPopulation = 500000;
  } else if (/\b(tens of thousands|small city|town)\b/i.test(queryText)) {
    estimatedPopulation = 50000;
  } else if (/\b(neighborhood|block|local area|specific area)\b/i.test(queryText)) {
    estimatedPopulation = 5000;
  }

  // High granularity indicators
  const requiresHighGranularity =
    /\b(detailed|granular|specific|precise|block group|neighborhood level)\b/i.test(queryText);

  // Geographic filter detection
  const hasGeographicFilter =
    /\b(where|in|near|around|within|between)\b/i.test(queryText) &&
    /\b(latitude|longitude|zip|zipcode|postal|geoid|fips)\b/i.test(queryText);

  return {
    mentionsState,
    mentionsCounty,
    mentionsTract,
    estimatedPopulation,
    requiresHighGranularity,
    hasGeographicFilter
  };
}

/**
 * Get table name for a geographic level
 */
export function getTableForLevel(level: GeoLevel): string {
  const tableMap: Record<GeoLevel, string> = {
    state: 'state_data',
    county: 'county_data',
    tract: 'tract_data',
    block_group: 'block_group_data_expanded'
  };

  return tableMap[level];
}

/**
 * Get GEOID length for a geographic level
 */
export function getGeoidLengthForLevel(level: GeoLevel): number {
  const lengthMap: Record<GeoLevel, number> = {
    state: 2,
    county: 5,
    tract: 11,
    block_group: 12
  };

  return lengthMap[level];
}

/**
 * Build hierarchical query across multiple levels
 * Example: Get all block groups in a county
 */
export function buildHierarchicalQuery(
  parentLevel: GeoLevel,
  parentGeoid: string,
  childLevel: GeoLevel
): string {
  const childTable = getTableForLevel(childLevel);
  const geoidLength = getGeoidLengthForLevel(parentLevel);

  // Child geoids start with parent geoid
  return `
    SELECT * FROM ${childTable}
    WHERE SUBSTRING(geoid, 1, ${geoidLength}) = '${parentGeoid}'
  `;
}

/**
 * Get aggregation query to roll up child level to parent
 */
export function buildAggregationQuery(
  fromLevel: GeoLevel,
  toLevel: GeoLevel,
  metrics: string[]
): string {
  const fromTable = getTableForLevel(fromLevel);
  const toGeoidLength = getGeoidLengthForLevel(toLevel);

  const aggMetrics = metrics
    .map(metric => {
      if (metric.includes('_pct') || metric.includes('_rate')) {
        return `ROUND(AVG(${metric}), 2) as ${metric}`;
      } else {
        return `SUM(${metric}) as ${metric}`;
      }
    })
    .join(', ');

  return `
    SELECT
      SUBSTRING(geoid, 1, ${toGeoidLength}) as parent_geoid,
      ${aggMetrics}
    FROM ${fromTable}
    GROUP BY SUBSTRING(geoid, 1, ${toGeoidLength})
  `;
}

/**
 * Smart routing decision with fallback
 */
export function routeQueryWithFallback(
  queryText: string,
  preferredLevel?: GeoLevel
): GeoRoutingDecision {
  // If preferred level specified, use it
  if (preferredLevel) {
    return {
      level: preferredLevel,
      table: getTableForLevel(preferredLevel),
      reasoning: `User-specified level: ${preferredLevel}`,
      estimatedRows: 1000
    };
  }

  // Parse intent and route
  const intent = parseQueryIntent(queryText);
  return determineGeoLevel(intent);
}

export default {
  determineGeoLevel,
  parseQueryIntent,
  getTableForLevel,
  getGeoidLengthForLevel,
  buildHierarchicalQuery,
  buildAggregationQuery,
  routeQueryWithFallback
};
