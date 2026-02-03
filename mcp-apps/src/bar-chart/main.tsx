/**
 * Bar Chart MCP App - Entry Point
 * Renders an interactive bar chart for demographic comparisons
 */

import { StrictMode, useState, useEffect, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { BarChart } from './BarChart';
import { ExportControls, type ColumnDef } from '../shared/ExportControls';
import type { ToolResult } from '../shared/app-bridge';

/**
 * Auto-detect chart configuration from data shape
 * - X-axis: First string column (typically name/region)
 * - Y-axes: All numeric columns
 */
function detectChartConfig(data: Record<string, unknown>[]): {
  xAxisKey: string;
  yAxisKeys: string[];
} {
  if (data.length === 0) {
    return { xAxisKey: '', yAxisKeys: [] };
  }

  const firstRow = data[0];
  const keys = Object.keys(firstRow);

  let xAxisKey = '';
  const yAxisKeys: string[] = [];

  for (const key of keys) {
    const value = firstRow[key];

    if (typeof value === 'string' && !xAxisKey) {
      // First string column becomes x-axis
      xAxisKey = key;
    } else if (typeof value === 'number') {
      // All numeric columns become y-axis candidates
      yAxisKeys.push(key);
    }
  }

  // Fallback: use first column as x-axis if no string found
  if (!xAxisKey && keys.length > 0) {
    xAxisKey = keys[0];
  }

  return { xAxisKey, yAxisKeys };
}

/**
 * Main App component
 */
function App() {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<ToolResult['metadata']>(undefined);

  /**
   * Handle tool result messages from the host
   */
  const handleToolResult = useCallback((result: ToolResult) => {
    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Query failed');
      setData([]);
      return;
    }

    setError(null);
    setData(result.data || []);
    setMetadata(result.metadata);
  }, []);

  /**
   * Handle Excel export request
   * Sends message to host for server-side Excel generation
   */
  const handleExcelExport = useCallback((exportData: Record<string, unknown>[], columns: string[]) => {
    window.parent.postMessage(
      {
        type: 'ui/message',
        payload: {
          action: 'export',
          format: 'excel',
          data: exportData,
          columns,
        },
      },
      '*'
    );
  }, []);

  /**
   * Set up message listener for communication with host
   */
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      if (!message || typeof message !== 'object') {
        return;
      }

      if (message.type === 'tool-result' && message.payload) {
        handleToolResult(message.payload as ToolResult);
      }
    };

    window.addEventListener('message', handleMessage);

    // Signal ready to host
    window.parent.postMessage({ type: 'ui/ready' }, '*');

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [handleToolResult]);

  // Auto-detect chart configuration
  const chartConfig = useMemo(() => detectChartConfig(data), [data]);

  // Generate column definitions for export
  const columns: ColumnDef[] = useMemo(() => {
    if (data.length === 0) return [];
    return Object.keys(data[0]).map((key) => ({
      id: key,
      header: key,
    }));
  }, [data]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
          <p className="text-gray-600 mt-3 text-sm">Loading chart data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] bg-red-50 p-4">
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-2">!</div>
          <p className="text-red-700 font-medium">Error</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] bg-gray-50 p-4">
        <div className="text-center">
          <p className="text-gray-600">No data to display</p>
        </div>
      </div>
    );
  }

  // No valid chart configuration
  if (!chartConfig.xAxisKey || chartConfig.yAxisKeys.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] bg-yellow-50 p-4">
        <div className="text-center">
          <p className="text-yellow-700 font-medium">Unable to render chart</p>
          <p className="text-yellow-600 text-sm mt-1">
            Data requires at least one categorical and one numeric column
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Metadata bar */}
      {metadata && (
        <div className="bg-blue-50 px-4 py-2 text-sm text-blue-700 border-b flex items-center justify-between">
          <span>
            {metadata.rowCount?.toLocaleString() || data.length.toLocaleString()} records
          </span>
          {metadata.tables && metadata.tables.length > 0 && (
            <span className="text-blue-500">
              Source: {metadata.tables.join(', ')}
            </span>
          )}
        </div>
      )}

      {/* Chart */}
      <div className="flex-1 p-4 overflow-auto custom-scrollbar">
        <BarChart
          data={data}
          xAxisKey={chartConfig.xAxisKey}
          yAxisKeys={chartConfig.yAxisKeys}
        />
      </div>

      {/* Export controls */}
      <ExportControls
        data={data}
        columns={columns}
        defaultFilename="census-chart-data"
        onExcelExport={handleExcelExport}
      />
    </div>
  );
}

// Mount the app
const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
