/**
 * Export utilities for MCP Apps
 * Provides CSV generation and file download functionality
 */

/**
 * Escape a value for CSV format
 * Handles commas, quotes, and newlines
 */
function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Convert data array to CSV string
 * Filters to selected columns and properly escapes values
 */
export function convertToCSV(data: Record<string, unknown>[], columns: string[]): string {
  if (data.length === 0) {
    return columns.join(',') + '\n';
  }

  // Header row
  const headerRow = columns.map(escapeCSVValue).join(',');

  // Data rows
  const dataRows = data.map((row) =>
    columns.map((col) => escapeCSVValue(row[col])).join(',')
  );

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Trigger browser download of content as a file
 */
export function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate a timestamped filename for exports
 */
export function generateFilename(prefix: string, format: 'csv' | 'xlsx'): string {
  const timestamp = new Date().toISOString().slice(0, 10);
  return `${prefix}-${timestamp}.${format}`;
}

/**
 * Filter data to only include selected columns
 */
export function filterDataColumns(
  data: Record<string, unknown>[],
  columns: string[]
): Record<string, unknown>[] {
  return data.map((row) => {
    const filtered: Record<string, unknown> = {};
    for (const col of columns) {
      if (col in row) {
        filtered[col] = row[col];
      }
    }
    return filtered;
  });
}
