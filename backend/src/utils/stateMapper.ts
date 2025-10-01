/**
 * State Abbreviation Mapper
 * Bidirectional mapping between US state abbreviations and full names
 */

export const STATE_MAPPINGS: Record<string, string> = {
  // State abbreviations to full names
  'AL': 'Alabama',
  'AK': 'Alaska',
  'AZ': 'Arizona',
  'AR': 'Arkansas',
  'CA': 'California',
  'CO': 'Colorado',
  'CT': 'Connecticut',
  'DE': 'Delaware',
  'DC': 'District of Columbia',
  'FL': 'Florida',
  'GA': 'Georgia',
  'HI': 'Hawaii',
  'ID': 'Idaho',
  'IL': 'Illinois',
  'IN': 'Indiana',
  'IA': 'Iowa',
  'KS': 'Kansas',
  'KY': 'Kentucky',
  'LA': 'Louisiana',
  'ME': 'Maine',
  'MD': 'Maryland',
  'MA': 'Massachusetts',
  'MI': 'Michigan',
  'MN': 'Minnesota',
  'MS': 'Mississippi',
  'MO': 'Missouri',
  'MT': 'Montana',
  'NE': 'Nebraska',
  'NV': 'Nevada',
  'NH': 'New Hampshire',
  'NJ': 'New Jersey',
  'NM': 'New Mexico',
  'NY': 'New York',
  'NC': 'North Carolina',
  'ND': 'North Dakota',
  'OH': 'Ohio',
  'OK': 'Oklahoma',
  'OR': 'Oregon',
  'PA': 'Pennsylvania',
  'RI': 'Rhode Island',
  'SC': 'South Carolina',
  'SD': 'South Dakota',
  'TN': 'Tennessee',
  'TX': 'Texas',
  'UT': 'Utah',
  'VT': 'Vermont',
  'VA': 'Virginia',
  'WA': 'Washington',
  'WV': 'West Virginia',
  'WI': 'Wisconsin',
  'WY': 'Wyoming'
};

// Reverse mapping: full name to abbreviation
export const STATE_ABBR_MAP: Record<string, string> = Object.entries(STATE_MAPPINGS).reduce(
  (acc, [abbr, fullName]) => {
    acc[fullName.toLowerCase()] = abbr;
    return acc;
  },
  {} as Record<string, string>
);

/**
 * Maps state abbreviation to full state name
 * @param abbr State abbreviation (e.g., "CA", "TX")
 * @returns Full state name (e.g., "California", "Texas") or original if not found
 */
export function mapStateToFullName(abbr: string): string {
  const upperAbbr = abbr.toUpperCase().trim();
  return STATE_MAPPINGS[upperAbbr] || abbr;
}

/**
 * Maps full state name to abbreviation
 * @param stateName Full state name (e.g., "California", "Texas")
 * @returns State abbreviation (e.g., "CA", "TX") or original if not found
 */
export function mapStateToAbbr(stateName: string): string {
  const lowerName = stateName.toLowerCase().trim();
  return STATE_ABBR_MAP[lowerName] || stateName;
}

/**
 * Preprocesses a query to replace state abbreviations with full names
 * Handles common patterns like "in CA", "CA counties", "Texas and CA"
 * @param query Natural language query
 * @returns Query with state abbreviations replaced by full names
 */
export function mapStateAbbreviationsInQuery(query: string): string {
  let processedQuery = query;

  // Match state abbreviations with word boundaries
  // Handles: "in CA", "CA counties", "CA,", "CA and TX", etc.
  const stateAbbrRegex = /\b([A-Z]{2})\b/g;

  processedQuery = processedQuery.replace(stateAbbrRegex, (match) => {
    const fullName = STATE_MAPPINGS[match];
    if (fullName) {
      console.log(`🗺️ Mapped state abbreviation: ${match} → ${fullName}`);
      return fullName;
    }
    return match;
  });

  return processedQuery;
}

/**
 * Checks if a string is a valid US state (abbreviation or full name)
 * @param state State string to check
 * @returns true if valid state, false otherwise
 */
export function isValidState(state: string): boolean {
  const upperState = state.toUpperCase().trim();
  const lowerState = state.toLowerCase().trim();

  return upperState in STATE_MAPPINGS || lowerState in STATE_ABBR_MAP;
}

/**
 * Normalizes state input to full name (handles both abbr and full name)
 * @param state State abbreviation or full name
 * @returns Full state name or original if not found
 */
export function normalizeStateName(state: string): string {
  // Try as abbreviation first
  const upperState = state.toUpperCase().trim();
  if (upperState in STATE_MAPPINGS) {
    return STATE_MAPPINGS[upperState];
  }

  // Check if it's already a full name
  const lowerState = state.toLowerCase().trim();
  if (lowerState in STATE_ABBR_MAP) {
    // Return properly capitalized full name
    return Object.keys(STATE_ABBR_MAP).find(
      name => name.toLowerCase() === lowerState
    ) || state;
  }

  // Return original if not found
  return state;
}
