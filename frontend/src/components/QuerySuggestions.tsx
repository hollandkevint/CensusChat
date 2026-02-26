'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  getSuggestions,
  getFollowUpSuggestions,
  getCategorySuggestions,
  getTrendingSuggestions,
  Suggestion,
  SuggestionContext
} from '../services/suggestionEngine';
import { Sparkles, TrendingUp, Stethoscope, BarChart3, Users, MapPin, ChevronRight } from 'lucide-react';

interface QuerySuggestionsProps {
  currentInput: string;
  lastQueryText?: string;
  lastQueryCategory?: 'healthcare' | 'marketing' | 'demographics' | 'geographic';
  onSelectSuggestion: (query: string) => void;
  className?: string;
}

const categoryIcons: Record<string, React.ReactNode> = {
  healthcare: <Stethoscope className="w-3.5 h-3.5" />,
  marketing: <BarChart3 className="w-3.5 h-3.5" />,
  demographics: <Users className="w-3.5 h-3.5" />,
  geographic: <MapPin className="w-3.5 h-3.5" />
};

const categoryColors: Record<string, string> = {
  healthcare: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  marketing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  demographics: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  geographic: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
};

export default function QuerySuggestions({
  currentInput,
  lastQueryText,
  lastQueryCategory,
  onSelectSuggestion,
  className = ''
}: QuerySuggestionsProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  // Build context for suggestions
  const context: SuggestionContext = useMemo(() => ({
    currentInput: currentInput || undefined,
    lastQueryCategory: lastQueryCategory || undefined
  }), [currentInput, lastQueryCategory]);

  // Get suggestions based on current state
  const suggestions = useMemo(() => {
    // If user is typing, show contextual suggestions
    if (currentInput && currentInput.length > 2) {
      return getSuggestions(context, 6);
    }

    // If filtering by category
    if (activeCategory) {
      return getCategorySuggestions(activeCategory as any, context);
    }

    // If there was a recent query, show follow-ups
    if (lastQueryText) {
      return getFollowUpSuggestions(lastQueryText, lastQueryCategory);
    }

    // Default: show trending
    return getTrendingSuggestions(6);
  }, [currentInput, activeCategory, lastQueryText, lastQueryCategory, context]);

  // Reset category filter when input changes
  useEffect(() => {
    if (currentInput && currentInput.length > 0) {
      setActiveCategory(null);
    }
  }, [currentInput]);

  // Don't show if typing a lot
  if (currentInput && currentInput.length > 50) {
    return null;
  }

  const categories = ['healthcare', 'marketing', 'demographics', 'geographic'];

  return (
    <div className={`${className}`}>
      {/* Header with toggle */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Suggestions</span>
          <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </button>

        {isExpanded && !currentInput && (
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-400">Popular queries</span>
          </div>
        )}
      </div>

      {isExpanded && (
        <>
          {/* Category filters - show when no input */}
          {!currentInput && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full transition-colors ${
                    activeCategory === cat
                      ? categoryColors[cat]
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {categoryIcons[cat]}
                  <span className="capitalize">{cat}</span>
                </button>
              ))}
            </div>
          )}

          {/* Suggestions list */}
          <div className="space-y-1.5">
            {suggestions.length > 0 ? (
              suggestions.map(suggestion => (
                <button
                  key={suggestion.id}
                  onClick={() => onSelectSuggestion(suggestion.text)}
                  className="w-full text-left group"
                >
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                    <div className={`flex-shrink-0 p-1 rounded ${categoryColors[suggestion.category]}`}>
                      {categoryIcons[suggestion.category]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 line-clamp-1">
                        {suggestion.text}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                        {suggestion.description}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 flex-shrink-0 mt-0.5" />
                  </div>
                </button>
              ))
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
                No suggestions for "{currentInput}"
              </p>
            )}
          </div>

          {/* Hint text */}
          {currentInput && currentInput.length > 0 && currentInput.length <= 2 && (
            <p className="text-xs text-gray-400 mt-2 text-center">
              Type more to see suggestions...
            </p>
          )}
        </>
      )}
    </div>
  );
}
