/**
 * ExportControls component for MCP Apps
 * Provides format selection, column picker, and export functionality
 */

import React, { useState, useCallback, useMemo } from 'react';
import { convertToCSV, downloadBlob, generateFilename, filterDataColumns } from './exportUtils';

export interface ColumnDef {
  id: string;
  header: string;
}

export interface ExportControlsProps {
  data: Record<string, unknown>[];
  columns: ColumnDef[];
  defaultFilename?: string;
  onExcelExport?: (data: Record<string, unknown>[], columns: string[]) => void;
}

type ExportFormat = 'csv' | 'excel';

/**
 * Export controls with format selector, column picker, and download
 */
export function ExportControls({
  data,
  columns,
  defaultFilename = 'census-data',
  onExcelExport,
}: ExportControlsProps): React.ReactElement {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');
  const [selectedColumns, setSelectedColumns] = useState<string[]>(() =>
    columns.map((c) => c.id)
  );
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);

  // Track column selection changes
  const toggleColumn = useCallback((columnId: string) => {
    setSelectedColumns((prev) =>
      prev.includes(columnId)
        ? prev.filter((c) => c !== columnId)
        : [...prev, columnId]
    );
  }, []);

  const selectAllColumns = useCallback(() => {
    setSelectedColumns(columns.map((c) => c.id));
  }, [columns]);

  const deselectAllColumns = useCallback(() => {
    setSelectedColumns([]);
  }, []);

  // Column count indicator
  const columnCountText = useMemo(() => {
    const total = columns.length;
    const selected = selectedColumns.length;
    return selected === total ? 'All columns' : `${selected}/${total} columns`;
  }, [columns.length, selectedColumns.length]);

  // Handle export action
  const handleExport = useCallback(() => {
    if (selectedColumns.length === 0) {
      return;
    }

    const filteredData = filterDataColumns(data, selectedColumns);

    if (selectedFormat === 'csv') {
      const csv = convertToCSV(filteredData, selectedColumns);
      const filename = generateFilename(defaultFilename, 'csv');
      downloadBlob(csv, filename, 'text/csv;charset=utf-8;');
    } else if (selectedFormat === 'excel' && onExcelExport) {
      onExcelExport(filteredData, selectedColumns);
    }
  }, [selectedFormat, selectedColumns, data, defaultFilename, onExcelExport]);

  const canExport = selectedColumns.length > 0 && data.length > 0;
  const showExcelOption = !!onExcelExport;

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 border-t border-gray-200 text-sm">
      {/* Format selector */}
      <div className="flex items-center gap-2">
        <label htmlFor="export-format" className="text-gray-600 font-medium">
          Format:
        </label>
        <select
          id="export-format"
          value={selectedFormat}
          onChange={(e) => setSelectedFormat(e.target.value as ExportFormat)}
          className="px-2 py-1 border border-gray-300 rounded bg-white text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="csv">CSV</option>
          {showExcelOption && <option value="excel">Excel</option>}
        </select>
      </div>

      {/* Column picker toggle */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsColumnPickerOpen(!isColumnPickerOpen)}
          className="flex items-center gap-1 px-2 py-1 border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-100 focus:ring-2 focus:ring-blue-500"
        >
          <span>{columnCountText}</span>
          <svg
            className={`w-4 h-4 transition-transform ${isColumnPickerOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Column picker dropdown */}
        {isColumnPickerOpen && (
          <div className="absolute left-0 mt-1 w-64 max-h-64 overflow-y-auto bg-white border border-gray-300 rounded-lg shadow-lg z-10">
            <div className="flex gap-2 p-2 border-b border-gray-200">
              <button
                type="button"
                onClick={selectAllColumns}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={deselectAllColumns}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Deselect All
              </button>
            </div>
            <div className="p-2 space-y-1">
              {columns.map((col) => (
                <label
                  key={col.id}
                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(col.id)}
                    onChange={() => toggleColumn(col.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700 truncate">{col.header}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Export button */}
      <button
        type="button"
        onClick={handleExport}
        disabled={!canExport}
        className={`px-3 py-1 rounded font-medium transition-colors ${
          canExport
            ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        Export {data.length.toLocaleString()} rows
      </button>

      {/* Row count info */}
      {!canExport && selectedColumns.length === 0 && (
        <span className="text-gray-500 text-xs">Select at least one column</span>
      )}
    </div>
  );
}

export default ExportControls;
