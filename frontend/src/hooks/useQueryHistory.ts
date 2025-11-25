import { useCallback } from 'react';
import { useQueryHistoryStore, SavedQuery, createResultSummary } from '../store/queryHistoryStore';

/**
 * Hook to interact with query history
 */
export function useQueryHistory() {
  const {
    queries,
    addQuery,
    removeQuery,
    toggleFavorite,
    clearHistory,
    clearNonFavorites,
    updateCategory,
    getRecentQueries,
    getFavorites,
    searchQueries,
    getByCategory
  } = useQueryHistoryStore();

  /**
   * Save a query to history with full result data
   */
  const saveQuery = useCallback((
    query: string,
    resultData: any[],
    metadata?: SavedQuery['metadata']
  ) => {
    addQuery({
      query,
      resultCount: resultData.length,
      category: 'custom', // Will be auto-detected in store
      metadata,
      resultSummary: createResultSummary(resultData)
    });
  }, [addQuery]);

  /**
   * Get formatted time ago string
   */
  const getTimeAgo = useCallback((date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(date).toLocaleDateString();
  }, []);

  /**
   * Get category icon
   */
  const getCategoryIcon = useCallback((category: SavedQuery['category']): string => {
    switch (category) {
      case 'healthcare': return '🏥';
      case 'marketing': return '📊';
      case 'demographics': return '👥';
      default: return '📝';
    }
  }, []);

  /**
   * Get category color classes
   */
  const getCategoryColor = useCallback((category: SavedQuery['category']): string => {
    switch (category) {
      case 'healthcare': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'marketing': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'demographics': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  }, []);

  return {
    // State
    queries,
    recentQueries: getRecentQueries(10),
    favorites: getFavorites(),

    // Actions
    saveQuery,
    removeQuery,
    toggleFavorite,
    clearHistory,
    clearNonFavorites,
    updateCategory,

    // Search & Filter
    searchQueries,
    getByCategory,
    getRecentQueries,

    // Helpers
    getTimeAgo,
    getCategoryIcon,
    getCategoryColor,

    // Stats
    totalQueries: queries.length,
    favoriteCount: getFavorites().length,
  };
}
