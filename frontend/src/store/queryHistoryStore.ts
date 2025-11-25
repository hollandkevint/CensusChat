import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface SavedQuery {
  id: string;
  query: string;
  timestamp: Date;
  resultCount: number;
  category: 'healthcare' | 'marketing' | 'demographics' | 'custom';
  isFavorite: boolean;
  metadata?: {
    queryTime?: number;
    dataSource?: string;
    geographyLevel?: string;
  };
  // Store a summary of results, not full data (to save storage)
  resultSummary?: {
    columns: string[];
    sampleData: any[];
  };
}

export interface QueryHistoryState {
  queries: SavedQuery[];
  maxQueries: number;

  // Actions
  addQuery: (query: Omit<SavedQuery, 'id' | 'timestamp' | 'isFavorite'>) => void;
  removeQuery: (id: string) => void;
  toggleFavorite: (id: string) => void;
  clearHistory: () => void;
  clearNonFavorites: () => void;
  updateCategory: (id: string, category: SavedQuery['category']) => void;

  // Getters
  getRecentQueries: (limit?: number) => SavedQuery[];
  getFavorites: () => SavedQuery[];
  searchQueries: (term: string) => SavedQuery[];
  getByCategory: (category: SavedQuery['category']) => SavedQuery[];
}

/**
 * Detect category from query text
 */
function detectCategory(query: string): SavedQuery['category'] {
  const lowerQuery = query.toLowerCase();

  // Healthcare keywords
  const healthcareKeywords = [
    'medicare', 'medicaid', 'healthcare', 'hospital', 'doctor', 'insurance',
    'uninsured', 'disability', 'ambulatory', 'senior', '65+', 'health'
  ];
  if (healthcareKeywords.some(kw => lowerQuery.includes(kw))) {
    return 'healthcare';
  }

  // Marketing keywords
  const marketingKeywords = [
    'income', 'affluent', 'wealthy', 'consumer', 'technology', 'broadband',
    'commute', 'occupation', 'employment', 'retail', 'marketing', 'target'
  ];
  if (marketingKeywords.some(kw => lowerQuery.includes(kw))) {
    return 'marketing';
  }

  // Demographics keywords
  const demographicsKeywords = [
    'population', 'age', 'race', 'ethnicity', 'education', 'housing',
    'family', 'household', 'county', 'state', 'tract', 'census'
  ];
  if (demographicsKeywords.some(kw => lowerQuery.includes(kw))) {
    return 'demographics';
  }

  return 'custom';
}

/**
 * Create a summary of query results for storage efficiency
 */
function createResultSummary(data: any[]): SavedQuery['resultSummary'] | undefined {
  if (!data || data.length === 0) return undefined;

  return {
    columns: Object.keys(data[0]),
    sampleData: data.slice(0, 3) // Store only first 3 rows as sample
  };
}

export const useQueryHistoryStore = create<QueryHistoryState>()(
  persist(
    (set, get) => ({
      queries: [],
      maxQueries: 100,

      addQuery: (queryData) => {
        const newQuery: SavedQuery = {
          id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
          isFavorite: false,
          category: queryData.category || detectCategory(queryData.query),
          ...queryData,
        };

        set((state) => {
          // Check for duplicate queries (same text within last 5 minutes)
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          const isDuplicate = state.queries.some(
            q => q.query === newQuery.query &&
                 new Date(q.timestamp) > fiveMinutesAgo
          );

          if (isDuplicate) {
            return state; // Don't add duplicate
          }

          // Add new query and trim to max
          const updatedQueries = [newQuery, ...state.queries];

          // Keep all favorites + most recent non-favorites up to maxQueries
          const favorites = updatedQueries.filter(q => q.isFavorite);
          const nonFavorites = updatedQueries.filter(q => !q.isFavorite);
          const trimmedNonFavorites = nonFavorites.slice(0, state.maxQueries - favorites.length);

          return {
            queries: [...favorites, ...trimmedNonFavorites].sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            )
          };
        });
      },

      removeQuery: (id) => {
        set((state) => ({
          queries: state.queries.filter(q => q.id !== id)
        }));
      },

      toggleFavorite: (id) => {
        set((state) => ({
          queries: state.queries.map(q =>
            q.id === id ? { ...q, isFavorite: !q.isFavorite } : q
          )
        }));
      },

      clearHistory: () => {
        set({ queries: [] });
      },

      clearNonFavorites: () => {
        set((state) => ({
          queries: state.queries.filter(q => q.isFavorite)
        }));
      },

      updateCategory: (id, category) => {
        set((state) => ({
          queries: state.queries.map(q =>
            q.id === id ? { ...q, category } : q
          )
        }));
      },

      getRecentQueries: (limit = 10) => {
        return get().queries.slice(0, limit);
      },

      getFavorites: () => {
        return get().queries.filter(q => q.isFavorite);
      },

      searchQueries: (term) => {
        const lowerTerm = term.toLowerCase();
        return get().queries.filter(q =>
          q.query.toLowerCase().includes(lowerTerm)
        );
      },

      getByCategory: (category) => {
        return get().queries.filter(q => q.category === category);
      },
    }),
    {
      name: 'censuschat-query-history',
      storage: createJSONStorage(() => localStorage),
      // Only persist queries array
      partialize: (state) => ({ queries: state.queries }),
      // Handle date serialization
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.queries = state.queries.map(q => ({
            ...q,
            timestamp: new Date(q.timestamp)
          }));
        }
      },
    }
  )
);

// Export helper to create result summary
export { createResultSummary };
