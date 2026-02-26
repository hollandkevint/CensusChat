'use client';

import React, { useState, useEffect } from 'react';
import {
  getDashboardData,
  DashboardData,
  formatDuration,
  formatPercentage,
  formatNumber
} from '../services/analyticsService';
import {
  BarChart3,
  Clock,
  Zap,
  AlertCircle,
  Activity,
  TrendingUp,
  Database,
  RefreshCw,
  Loader2,
  Stethoscope,
  Users,
  MapPin
} from 'lucide-react';

interface AnalyticsDashboardProps {
  className?: string;
  refreshInterval?: number; // in seconds
}

const categoryIcons: Record<string, React.ReactNode> = {
  healthcare: <Stethoscope className="w-4 h-4" />,
  marketing: <BarChart3 className="w-4 h-4" />,
  demographics: <Users className="w-4 h-4" />,
  geographic: <MapPin className="w-4 h-4" />,
  custom: <Database className="w-4 h-4" />
};

const categoryColors: Record<string, string> = {
  healthcare: 'text-red-500',
  marketing: 'text-blue-500',
  demographics: 'text-green-500',
  geographic: 'text-purple-500',
  custom: 'text-gray-500'
};

export default function AnalyticsDashboard({
  className = '',
  refreshInterval = 60
}: AnalyticsDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadData = async () => {
    try {
      setError(null);
      const dashboardData = await getDashboardData();

      if (dashboardData) {
        setData(dashboardData);
        setLastRefresh(new Date());
      } else {
        setError('Analytics service unavailable');
      }
    } catch (err) {
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Set up auto-refresh
    const interval = setInterval(loadData, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={`p-6 text-center ${className}`}>
        <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">{error || 'No data available'}</p>
        <button
          onClick={loadData}
          className="mt-4 px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  const { summary, performance, popularCategories, geographyUsage } = data;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-500" />
          Usage Analytics
        </h2>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          {lastRefresh && (
            <span>Updated {lastRefresh.toLocaleTimeString()}</span>
          )}
          <button
            onClick={() => {
              setLoading(true);
              loadData();
            }}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Queries */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
            <Database className="w-4 h-4" />
            <span className="text-xs">Total Queries</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatNumber(summary?.totalQueries || 0)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {formatNumber(summary?.queriesLast24h || 0)} last 24h
          </p>
        </div>

        {/* Avg Response Time */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs">Avg Response</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatDuration(summary?.avgExecutionTime || 0)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            p99: {formatDuration(summary?.performancePercentiles?.p99 || 0)}
          </p>
        </div>

        {/* Cache Hit Rate */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
            <Zap className="w-4 h-4" />
            <span className="text-xs">Cache Hit Rate</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatPercentage(summary?.cacheHitRate || 0)}
          </p>
          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 mt-2">
            <div
              className="bg-green-500 h-1.5 rounded-full"
              style={{ width: `${(summary?.cacheHitRate || 0) * 100}%` }}
            />
          </div>
        </div>

        {/* Error Rate */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs">Error Rate</span>
          </div>
          <p className={`text-2xl font-bold ${
            (summary?.errorRate || 0) > 0.05
              ? 'text-red-500'
              : 'text-green-500'
          }`}>
            {formatPercentage(summary?.errorRate || 0)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {(summary?.errorRate || 0) < 0.01 ? 'Healthy' : 'Needs attention'}
          </p>
        </div>
      </div>

      {/* Categories & Geography */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Categories */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            Top Query Categories
          </h3>
          {popularCategories.length > 0 ? (
            <div className="space-y-3">
              {popularCategories.slice(0, 5).map((cat) => {
                const maxCount = Math.max(...popularCategories.map(c => c.count));
                const percentage = (cat.count / maxCount) * 100;

                return (
                  <div key={cat.category}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`flex items-center gap-1.5 text-sm ${categoryColors[cat.category]}`}>
                        {categoryIcons[cat.category]}
                        <span className="capitalize">{cat.category}</span>
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        {formatNumber(cat.count)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          cat.category === 'healthcare' ? 'bg-red-400' :
                          cat.category === 'marketing' ? 'bg-blue-400' :
                          cat.category === 'demographics' ? 'bg-green-400' :
                          cat.category === 'geographic' ? 'bg-purple-400' :
                          'bg-gray-400'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              No query data yet
            </p>
          )}
        </div>

        {/* Geography Usage */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-purple-500" />
            Geography Level Usage
          </h3>
          {geographyUsage.length > 0 ? (
            <div className="space-y-3">
              {geographyUsage.map((geo) => (
                <div key={geo.level}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                      {geo.level.replace('_', ' ')}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {formatPercentage(geo.percentage / 100)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                    <div
                      className="bg-purple-400 h-2 rounded-full"
                      style={{ width: `${geo.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              No geography data yet
            </p>
          )}
        </div>
      </div>

      {/* Query Volume Chart */}
      {summary?.queryVolume && summary.queryVolume.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-green-500" />
            Query Volume (Last 24 Hours)
          </h3>
          <div className="flex items-end gap-1 h-24">
            {summary.queryVolume.map((point, index) => {
              const maxCount = Math.max(...summary.queryVolume.map(p => p.count));
              const height = maxCount > 0 ? (point.count / maxCount) * 100 : 0;

              return (
                <div
                  key={index}
                  className="flex-1 bg-blue-400 dark:bg-blue-500 rounded-t transition-all hover:bg-blue-500 dark:hover:bg-blue-400"
                  style={{ height: `${Math.max(height, 2)}%` }}
                  title={`${point.hour}: ${point.count} queries`}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span>24h ago</span>
            <span>Now</span>
          </div>
        </div>
      )}

      {/* Performance Stats */}
      {performance && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            Performance Percentiles
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">p50 (Median)</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatDuration(performance.p50ResponseTime)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">p90</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatDuration(performance.p90ResponseTime)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">p99</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatDuration(performance.p99ResponseTime)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
