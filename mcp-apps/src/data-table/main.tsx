/**
 * Data Table MCP App - Entry Point
 * Renders an interactive data table with sorting, filtering, and drill-down
 */

import { StrictMode, useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { DataTable } from './DataTable';
import type { ToolResult, DrillDownParams } from '../shared/app-bridge';

/**
 * Breadcrumb for navigation history
 */
interface Breadcrumb {
  fips: string;
  name: string;
  level: 'state' | 'county' | 'blockgroup';
}

/**
 * Main App component
 * Manages state, MCP connection, and drill-down navigation
 */
function App() {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
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
   * Handle drill-down into a county's block groups
   */
  const handleDrillDown = useCallback((params: DrillDownParams) => {
    // Send drill-down request to host
    window.parent.postMessage(
      {
        type: 'ui/drill-down',
        payload: params,
      },
      '*'
    );

    // Update breadcrumbs if we have county info
    if (params.filters?.countyFips && params.filters?.countyName) {
      setBreadcrumbs(prev => [
        ...prev,
        {
          fips: params.filters!.countyFips as string,
          name: params.filters!.countyName as string,
          level: 'county',
        },
      ]);
    }

    setLoading(true);
  }, []);

  /**
   * Navigate back via breadcrumbs
   */
  const handleBreadcrumbClick = useCallback((index: number) => {
    // TODO: Implement navigation back to previous level
    // This would require calling a tool to re-fetch parent data
    setBreadcrumbs(prev => prev.slice(0, index));
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

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
          <p className="text-gray-600 mt-3 text-sm">Loading data...</p>
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

  return (
    <div className="h-full flex flex-col">
      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <div className="bg-gray-100 px-4 py-2 text-sm flex items-center gap-2 border-b">
          <button
            onClick={() => handleBreadcrumbClick(0)}
            className="text-blue-600 hover:text-blue-800 hover:underline"
          >
            Home
          </button>
          {breadcrumbs.map((crumb, idx) => (
            <span key={crumb.fips} className="flex items-center gap-2">
              <span className="text-gray-400">/</span>
              <button
                onClick={() => handleBreadcrumbClick(idx + 1)}
                className={`${
                  idx === breadcrumbs.length - 1
                    ? 'text-gray-700 font-medium'
                    : 'text-blue-600 hover:text-blue-800 hover:underline'
                }`}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Metadata bar */}
      {metadata && (
        <div className="bg-blue-50 px-4 py-2 text-sm text-blue-700 border-b flex items-center justify-between">
          <span>
            {metadata.rowCount?.toLocaleString() || data.length.toLocaleString()} records
            {metadata.hasMore && ' (more available)'}
          </span>
          {metadata.tables && metadata.tables.length > 0 && (
            <span className="text-blue-500">
              Source: {metadata.tables.join(', ')}
            </span>
          )}
        </div>
      )}

      {/* Data table */}
      <div className="flex-1 overflow-hidden">
        <DataTable
          data={data}
          onDrillDown={handleDrillDown}
        />
      </div>
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
