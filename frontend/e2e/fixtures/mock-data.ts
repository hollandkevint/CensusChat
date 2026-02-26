/**
 * Mock data fixtures for e2e tests
 */

export const mockQueryResponse = {
  success: true,
  message: 'Found 5 records matching your query',
  data: [
    {
      county: 'Miami-Dade',
      state: 'Florida',
      seniors: 456789,
      income_over_50k: 234567,
      ma_eligible: 198456,
      total_population: 2716940,
      median_income: 58000,
      poverty_rate: 15.2
    },
    {
      county: 'Broward',
      state: 'Florida',
      seniors: 345678,
      income_over_50k: 189234,
      ma_eligible: 156789,
      total_population: 1952778,
      median_income: 62000,
      poverty_rate: 12.8
    },
    {
      county: 'Palm Beach',
      state: 'Florida',
      seniors: 289456,
      income_over_50k: 167890,
      ma_eligible: 145678,
      total_population: 1496770,
      median_income: 68000,
      poverty_rate: 11.5
    },
    {
      county: 'Hillsborough',
      state: 'Florida',
      seniors: 234567,
      income_over_50k: 145678,
      ma_eligible: 123456,
      total_population: 1471968,
      median_income: 59000,
      poverty_rate: 13.4
    },
    {
      county: 'Orange',
      state: 'Florida',
      seniors: 198765,
      income_over_50k: 134567,
      ma_eligible: 112345,
      total_population: 1393452,
      median_income: 57000,
      poverty_rate: 14.1
    }
  ],
  metadata: {
    queryTime: 1.234,
    totalRecords: 5,
    dataSource: 'US Census Bureau ACS 2023',
    confidenceLevel: 0.95,
    marginOfError: 2.3,
    cached: false
  }
};

export const mockShareResponse = {
  success: true,
  shareId: 'test-share-123',
  shareUrl: '/share/test-share-123',
  expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
};

export const mockSharedQuery = {
  id: 'test-share-123',
  queryText: 'Show me Medicare eligible seniors in Florida',
  queryResult: {
    data: mockQueryResponse.data,
    columns: ['county', 'state', 'seniors', 'income_over_50k', 'ma_eligible', 'total_population', 'median_income', 'poverty_rate'],
    rowCount: 5
  },
  category: 'healthcare' as const,
  createdAt: Date.now(),
  expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  expirationOption: '7d' as const,
  viewCount: 42,
  title: 'Florida Medicare Analysis',
  description: 'Healthcare analysis for Florida counties'
};

export const mockAnalyticsSummary = {
  totalQueries: 1234,
  queriesLast24h: 89,
  queriesLastHour: 12,
  cacheHitRate: 0.73,
  avgExecutionTime: 1456,
  errorRate: 0.02,
  topCategories: [
    { category: 'healthcare', count: 567 },
    { category: 'marketing', count: 345 },
    { category: 'demographics', count: 234 },
    { category: 'geographic', count: 88 }
  ],
  queryVolume: Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    count: Math.floor(Math.random() * 20)
  })),
  performancePercentiles: {
    p50: 890,
    p90: 2100,
    p99: 4500
  }
};

export const mockAnalyticsDashboard = {
  summary: mockAnalyticsSummary,
  performance: {
    avgResponseTime: 1456,
    p50ResponseTime: 890,
    p90ResponseTime: 2100,
    p99ResponseTime: 4500,
    queryCount: 89,
    errorCount: 2,
    cacheHitRate: 0.73,
    timeRange: {
      start: Date.now() - 24 * 60 * 60 * 1000,
      end: Date.now()
    }
  },
  popularCategories: [
    { category: 'healthcare', count: 567, avgExecutionTime: 1200 },
    { category: 'marketing', count: 345, avgExecutionTime: 1400 },
    { category: 'demographics', count: 234, avgExecutionTime: 1100 }
  ],
  geographyUsage: [
    { level: 'state', count: 234, percentage: 35 },
    { level: 'county', count: 456, percentage: 45 },
    { level: 'tract', count: 123, percentage: 12 },
    { level: 'block_group', count: 78, percentage: 8 }
  ],
  generatedAt: new Date().toISOString()
};

export const mockErrorResponse = {
  success: false,
  message: 'I had trouble understanding your query. Please try rephrasing.',
  error: 'VALIDATION_ERROR',
  suggestions: [
    'Try being more specific about the geography',
    'Include a state or county name',
    'Use terms like "seniors", "income", or "population"'
  ]
};

export const mockHealthResponse = {
  status: 'healthy',
  version: '1.0.0',
  timestamp: new Date().toISOString(),
  services: {
    database: 'connected',
    redis: 'connected',
    mcp: 'ready'
  }
};
