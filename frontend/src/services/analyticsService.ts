/**
 * Analytics Service - Client-side API for tracking and analytics
 */

export type QueryEventType = 'query_executed' | 'query_cached' | 'query_error' | 'export_generated' | 'share_created';
export type QueryCategory = 'healthcare' | 'marketing' | 'demographics' | 'geographic' | 'custom';

export interface QueryEvent {
  eventType: QueryEventType;
  queryCategory?: QueryCategory;
  executionTime?: number;
  rowCount?: number;
  cacheHit?: boolean;
  errorType?: string;
  geographyLevel?: string;
}

export interface AnalyticsSummary {
  totalQueries: number;
  queriesLast24h: number;
  queriesLastHour: number;
  cacheHitRate: number;
  avgExecutionTime: number;
  errorRate: number;
  topCategories: Array<{ category: string; count: number }>;
  queryVolume: Array<{ hour: string; count: number }>;
  performancePercentiles: {
    p50: number;
    p90: number;
    p99: number;
  };
}

export interface PerformanceMetrics {
  avgResponseTime: number;
  p50ResponseTime: number;
  p90ResponseTime: number;
  p99ResponseTime: number;
  queryCount: number;
  errorCount: number;
  cacheHitRate: number;
  timeRange: { start: number; end: number };
}

export interface DashboardData {
  summary: AnalyticsSummary | null;
  performance: PerformanceMetrics | null;
  popularCategories: Array<{ category: QueryCategory; count: number; avgExecutionTime: number }>;
  geographyUsage: Array<{ level: string; count: number; percentage: number }>;
  generatedAt: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Track a query event
 */
export async function trackEvent(event: QueryEvent): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/analytics/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Error tracking event:', error);
    return false;
  }
}

/**
 * Get analytics summary
 */
export async function getAnalyticsSummary(): Promise<AnalyticsSummary | null> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/analytics/summary`);
    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error('Error getting analytics summary:', error);
    return null;
  }
}

/**
 * Get performance metrics
 */
export async function getPerformanceMetrics(
  hours: number = 24
): Promise<PerformanceMetrics | null> {
  try {
    const response = await fetch(
      `${API_BASE}/api/v1/analytics/performance?hours=${hours}`
    );
    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error('Error getting performance metrics:', error);
    return null;
  }
}

/**
 * Get dashboard data
 */
export async function getDashboardData(): Promise<DashboardData | null> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/analytics/dashboard`);
    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error('Error getting dashboard data:', error);
    return null;
  }
}

/**
 * Format duration in milliseconds to human readable
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Format percentage
 */
export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Format large numbers with K/M suffix
 */
export function formatNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}
