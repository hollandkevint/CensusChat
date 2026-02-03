/**
 * Dynamic Column Definition Generator
 * Creates TanStack Table column definitions from data
 */

import type { ColumnDef } from '@tanstack/react-table';

/**
 * Column metadata for special handling
 */
interface ColumnMeta {
  isDrillable?: boolean;
  isNumeric?: boolean;
}

/**
 * Format column header from snake_case to Title Case
 */
export function formatColumnHeader(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Format cell value for display
 */
export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '-';
  }
  if (typeof value === 'number') {
    // Format percentages
    if (value >= 0 && value <= 1) {
      return (value * 100).toFixed(1) + '%';
    }
    // Format large numbers with locale separators
    return value.toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Check if a column contains numeric values
 */
function isNumericColumn(data: Record<string, unknown>[], key: string): boolean {
  // Check first 10 rows for numeric values
  const sample = data.slice(0, 10);
  const numericCount = sample.filter((row) => typeof row[key] === 'number').length;
  return numericCount > sample.length / 2;
}

/**
 * Check if a column is drillable (county data that can drill to block groups)
 */
function isDrillableColumn(key: string): boolean {
  const drillableKeys = [
    'county_name',
    'county',
    'name', // Often the county name
  ];
  return drillableKeys.includes(key.toLowerCase());
}

/**
 * Get the FIPS code column key from data
 */
export function getFipsColumn(data: Record<string, unknown>[]): string | null {
  if (data.length === 0) return null;

  const keys = Object.keys(data[0]);
  const fipsKeys = ['county_fips', 'fips', 'geoid', 'fips_code'];

  for (const fipsKey of fipsKeys) {
    if (keys.includes(fipsKey)) {
      return fipsKey;
    }
  }

  return null;
}

/**
 * Generate column definitions from data
 */
export function generateColumns(
  data: Record<string, unknown>[],
  onDrillDown?: (params: { countyFips: string; countyName: string }) => void
): ColumnDef<Record<string, unknown>>[] {
  if (data.length === 0) {
    return [];
  }

  const keys = Object.keys(data[0]);
  const fipsColumn = getFipsColumn(data);

  return keys.map((key): ColumnDef<Record<string, unknown>> => {
    const isNumeric = isNumericColumn(data, key);
    const isDrillable = isDrillableColumn(key) && fipsColumn && onDrillDown;

    const meta: ColumnMeta = {
      isDrillable: Boolean(isDrillable),
      isNumeric,
    };

    return {
      accessorKey: key,
      header: formatColumnHeader(key),
      meta,
      cell: ({ getValue, row }) => {
        const value = getValue();
        const formatted = formatCellValue(value);

        // Drillable cells are clickable links
        if (isDrillable && fipsColumn) {
          const fips = row.original[fipsColumn] as string;
          return (
            <button
              onClick={() => onDrillDown({ countyFips: fips, countyName: formatted })}
              className="text-blue-600 hover:text-blue-800 hover:underline text-left"
            >
              {formatted}
            </button>
          );
        }

        return (
          <span className={isNumeric ? 'tabular-nums text-right block' : ''}>
            {formatted}
          </span>
        );
      },
      // Enable sorting
      enableSorting: true,
      // Custom sort function for numeric columns
      sortingFn: isNumeric ? 'basic' : 'alphanumeric',
    };
  });
}
