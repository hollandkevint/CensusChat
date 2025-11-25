/**
 * ChartSelector - Automatically selects the optimal chart type based on data characteristics
 */

export type ChartType = 'bar' | 'line' | 'pie' | 'scatter' | 'table';

export interface ChartRecommendation {
  type: ChartType;
  confidence: number;
  reason: string;
}

interface DataCharacteristics {
  rowCount: number;
  columns: string[];
  numericColumns: string[];
  categoricalColumns: string[];
  hasGeography: boolean;
  hasTimeSeries: boolean;
  uniqueCategoricalValues: Record<string, number>;
}

/**
 * Analyze data to determine its characteristics
 */
export function analyzeData(data: any[]): DataCharacteristics {
  if (!data || data.length === 0) {
    return {
      rowCount: 0,
      columns: [],
      numericColumns: [],
      categoricalColumns: [],
      hasGeography: false,
      hasTimeSeries: false,
      uniqueCategoricalValues: {}
    };
  }

  const columns = Object.keys(data[0]);
  const numericColumns: string[] = [];
  const categoricalColumns: string[] = [];
  const uniqueCategoricalValues: Record<string, number> = {};

  // Geography-related column patterns
  const geoPatterns = ['state', 'county', 'tract', 'block', 'geoid', 'fips', 'zip', 'city', 'region'];
  const timePatterns = ['year', 'month', 'date', 'quarter', 'period'];

  let hasGeography = false;
  let hasTimeSeries = false;

  columns.forEach(col => {
    const colLower = col.toLowerCase();

    // Check for geography
    if (geoPatterns.some(p => colLower.includes(p))) {
      hasGeography = true;
    }

    // Check for time series
    if (timePatterns.some(p => colLower.includes(p))) {
      hasTimeSeries = true;
    }

    // Determine column type by sampling values
    const sampleValues = data.slice(0, Math.min(10, data.length)).map(row => row[col]);
    const numericCount = sampleValues.filter(v => typeof v === 'number' || !isNaN(Number(v))).length;

    if (numericCount > sampleValues.length * 0.7) {
      numericColumns.push(col);
    } else {
      categoricalColumns.push(col);
      // Count unique values
      const uniqueValues = new Set(data.map(row => row[col]));
      uniqueCategoricalValues[col] = uniqueValues.size;
    }
  });

  return {
    rowCount: data.length,
    columns,
    numericColumns,
    categoricalColumns,
    hasGeography,
    hasTimeSeries,
    uniqueCategoricalValues
  };
}

/**
 * Select the optimal chart type based on data characteristics
 */
export function selectChartType(data: any[], queryIntent?: string): ChartRecommendation {
  const characteristics = analyzeData(data);

  // Too little data - use table
  if (characteristics.rowCount === 0) {
    return { type: 'table', confidence: 1.0, reason: 'No data available' };
  }

  // Very large datasets - use table for performance
  if (characteristics.rowCount > 100) {
    return {
      type: 'table',
      confidence: 0.8,
      reason: 'Large dataset best displayed as table'
    };
  }

  // Check for pie chart suitability (small number of categories, has numeric value)
  const smallCategorical = Object.entries(characteristics.uniqueCategoricalValues)
    .find(([_, count]) => count >= 2 && count <= 8);

  if (smallCategorical && characteristics.numericColumns.length >= 1 && characteristics.rowCount <= 10) {
    return {
      type: 'pie',
      confidence: 0.85,
      reason: `Composition view for ${smallCategorical[0]} (${smallCategorical[1]} categories)`
    };
  }

  // Time series data - use line chart
  if (characteristics.hasTimeSeries && characteristics.numericColumns.length >= 1) {
    return {
      type: 'line',
      confidence: 0.9,
      reason: 'Time series data best shown as line chart'
    };
  }

  // Geographic or categorical comparison - use bar chart
  if (characteristics.hasGeography && characteristics.numericColumns.length >= 1) {
    return {
      type: 'bar',
      confidence: 0.9,
      reason: 'Geographic comparison best shown as bar chart'
    };
  }

  // Multiple numeric columns - scatter plot for correlation
  if (characteristics.numericColumns.length >= 2 && characteristics.rowCount >= 5) {
    return {
      type: 'scatter',
      confidence: 0.75,
      reason: 'Multiple numeric variables can show correlation'
    };
  }

  // Default to bar chart for categorical + numeric data
  if (characteristics.categoricalColumns.length >= 1 && characteristics.numericColumns.length >= 1) {
    return {
      type: 'bar',
      confidence: 0.8,
      reason: 'Categorical comparison displayed as bar chart'
    };
  }

  // Fallback to table
  return {
    type: 'table',
    confidence: 0.6,
    reason: 'Default table view for mixed data'
  };
}

/**
 * Get the best columns for X and Y axes
 */
export function selectAxes(data: any[]): { xKey: string; yKeys: string[] } {
  const characteristics = analyzeData(data);

  // Default selections
  let xKey = characteristics.categoricalColumns[0] || characteristics.columns[0];
  let yKeys = characteristics.numericColumns.slice(0, 3); // Up to 3 numeric columns

  // Prefer geographic columns for X axis
  const geoPatterns = ['state', 'county', 'name', 'region'];
  const geoColumn = characteristics.categoricalColumns.find(col =>
    geoPatterns.some(p => col.toLowerCase().includes(p))
  );
  if (geoColumn) {
    xKey = geoColumn;
  }

  // Prefer meaningful numeric columns for Y
  const meaningfulPatterns = ['population', 'income', 'median', 'total', 'count', 'rate', 'percent'];
  const meaningfulNumeric = characteristics.numericColumns.filter(col =>
    meaningfulPatterns.some(p => col.toLowerCase().includes(p))
  );
  if (meaningfulNumeric.length > 0) {
    yKeys = meaningfulNumeric.slice(0, 3);
  }

  // Ensure we have at least one y key
  if (yKeys.length === 0 && characteristics.numericColumns.length > 0) {
    yKeys = [characteristics.numericColumns[0]];
  }

  return { xKey, yKeys };
}

/**
 * Format column name for display
 */
export function formatColumnName(column: string): string {
  return column
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\b\w/g, l => l.toUpperCase())
    .trim();
}

/**
 * Get chart colors
 */
export function getChartColors(): string[] {
  return [
    '#3B82F6', // blue-500
    '#10B981', // emerald-500
    '#F59E0B', // amber-500
    '#EF4444', // red-500
    '#8B5CF6', // violet-500
    '#EC4899', // pink-500
    '#06B6D4', // cyan-500
    '#84CC16', // lime-500
  ];
}
