'use client';

import React, { useState, useMemo } from 'react';
import { useQueryHistory } from '../hooks/useQueryHistory';
import { SavedQuery } from '../store/queryHistoryStore';
import {
  History,
  Star,
  StarOff,
  Trash2,
  Search,
  X,
  Play,
  ChevronDown,
  ChevronUp,
  Filter
} from 'lucide-react';

interface QueryHistoryProps {
  onSelectQuery: (query: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function QueryHistory({ onSelectQuery, isOpen, onClose }: QueryHistoryProps) {
  const {
    queries,
    favorites,
    removeQuery,
    toggleFavorite,
    clearHistory,
    clearNonFavorites,
    searchQueries,
    getByCategory,
    getTimeAgo,
    getCategoryIcon,
    getCategoryColor,
    totalQueries,
    favoriteCount
  } = useQueryHistory();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SavedQuery['category'] | 'all'>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter queries based on search and filters
  const filteredQueries = useMemo(() => {
    let result = queries;

    // Search filter
    if (searchTerm) {
      result = searchQueries(searchTerm);
    }

    // Category filter
    if (selectedCategory !== 'all') {
      result = result.filter(q => q.category === selectedCategory);
    }

    // Favorites filter
    if (showFavoritesOnly) {
      result = result.filter(q => q.isFavorite);
    }

    return result;
  }, [queries, searchTerm, selectedCategory, showFavoritesOnly, searchQueries]);

  const handleSelectQuery = (query: SavedQuery) => {
    onSelectQuery(query.query);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white dark:bg-gray-800 shadow-2xl z-50 flex flex-col border-l border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h2 className="font-semibold text-gray-900 dark:text-white">Query History</h2>
          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
            {totalQueries}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search queries..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2"
            >
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded-lg transition-colors ${
            showFavoritesOnly
              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          <Star className="w-3 h-3" />
          Favorites ({favoriteCount})
        </button>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value as SavedQuery['category'] | 'all')}
          className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
        >
          <option value="all">All Categories</option>
          <option value="healthcare">🏥 Healthcare</option>
          <option value="marketing">📊 Marketing</option>
          <option value="demographics">👥 Demographics</option>
          <option value="custom">📝 Custom</option>
        </select>
      </div>

      {/* Query List */}
      <div className="flex-1 overflow-y-auto">
        {filteredQueries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <History className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">No queries found</p>
            {searchTerm && (
              <p className="text-xs mt-1">Try a different search term</p>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {filteredQueries.map((query) => (
              <li
                key={query.id}
                className="group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="px-4 py-3">
                  {/* Query Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => handleSelectQuery(query)}
                        className="text-left text-sm text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 line-clamp-2"
                      >
                        {query.query}
                      </button>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => toggleFavorite(query.id)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        title={query.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        {query.isFavorite ? (
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        ) : (
                          <StarOff className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                      <button
                        onClick={() => handleSelectQuery(query)}
                        className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Run query"
                      >
                        <Play className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </button>
                      <button
                        onClick={() => removeQuery(query.id)}
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete query"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>

                  {/* Query Meta */}
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className={`px-1.5 py-0.5 rounded ${getCategoryColor(query.category)}`}>
                      {getCategoryIcon(query.category)} {query.category}
                    </span>
                    <span>{query.resultCount.toLocaleString()} results</span>
                    <span>•</span>
                    <span>{getTimeAgo(query.timestamp)}</span>
                  </div>

                  {/* Expandable Details */}
                  {query.resultSummary && (
                    <div className="mt-2">
                      <button
                        onClick={() => setExpandedId(expandedId === query.id ? null : query.id)}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        {expandedId === query.id ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                        Preview
                      </button>

                      {expandedId === query.id && (
                        <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs overflow-x-auto">
                          <p className="text-gray-600 dark:text-gray-400 mb-1">
                            Columns: {query.resultSummary.columns.join(', ')}
                          </p>
                          {query.metadata?.queryTime && (
                            <p className="text-gray-500 dark:text-gray-500">
                              Query time: {query.metadata.queryTime.toFixed(2)}s
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer Actions */}
      {totalQueries > 0 && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-between">
          <button
            onClick={clearNonFavorites}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Clear non-favorites
          </button>
          <button
            onClick={clearHistory}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
