/**
 * DataTable Component
 * TanStack Table implementation with sorting, filtering, pagination, and drill-down
 */

import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import { generateColumns } from './columns';
import type { DrillDownParams } from '../shared/app-bridge';

interface DataTableProps {
  data: Record<string, unknown>[];
  onDrillDown?: (params: DrillDownParams) => void;
}

/**
 * Column filter input component
 */
function ColumnFilter({
  column,
  isNumeric,
}: {
  column: any;
  isNumeric?: boolean;
}) {
  const columnFilterValue = column.getFilterValue();

  if (isNumeric) {
    return (
      <div className="flex gap-1">
        <input
          type="number"
          value={(columnFilterValue as [number, number])?.[0] ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            column.setFilterValue((old: [number, number]) => [
              val ? Number(val) : undefined,
              old?.[1],
            ]);
          }}
          placeholder="Min"
          className="w-16 px-1 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <input
          type="number"
          value={(columnFilterValue as [number, number])?.[1] ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            column.setFilterValue((old: [number, number]) => [
              old?.[0],
              val ? Number(val) : undefined,
            ]);
          }}
          placeholder="Max"
          className="w-16 px-1 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    );
  }

  return (
    <input
      type="text"
      value={(columnFilterValue ?? '') as string}
      onChange={(e) => column.setFilterValue(e.target.value)}
      placeholder="Filter..."
      className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
    />
  );
}

/**
 * Sort direction indicator
 */
function SortIndicator({ direction }: { direction: false | 'asc' | 'desc' }) {
  if (direction === false) {
    return <span className="text-gray-300 ml-1">&#8645;</span>;
  }
  return (
    <span className="ml-1 text-blue-600">
      {direction === 'asc' ? '&#8593;' : '&#8595;'}
    </span>
  );
}

export function DataTable({ data, onDrillDown }: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Handle drill-down click
  const handleDrillDown = useMemo(() => {
    if (!onDrillDown) return undefined;

    return (params: { countyFips: string; countyName: string }) => {
      onDrillDown({
        filters: {
          countyFips: params.countyFips,
          countyName: params.countyName,
        },
      });
    };
  }, [onDrillDown]);

  // Generate columns from data
  const columns = useMemo(
    () => generateColumns(data, handleDrillDown),
    [data, handleDrillDown]
  );

  // Create table instance
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    // Enable multi-column sort with shift+click
    enableMultiSort: true,
    // Default page size
    initialState: {
      pagination: {
        pageSize: 25,
      },
    },
    // Custom filter function for numeric range
    filterFns: {
      inNumberRange: (row, columnId, value) => {
        const rowValue = row.getValue(columnId) as number;
        const [min, max] = value as [number | undefined, number | undefined];
        if (min !== undefined && rowValue < min) return false;
        if (max !== undefined && rowValue > max) return false;
        return true;
      },
    },
  });

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-1 text-sm rounded border transition-colors ${
              showFilters
                ? 'bg-blue-100 border-blue-300 text-blue-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
            }`}
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
          {columnFilters.length > 0 && (
            <button
              onClick={() => setColumnFilters([])}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear filters ({columnFilters.length})
            </button>
          )}
        </div>
        <div className="text-sm text-gray-600">
          {table.getFilteredRowModel().rows.length.toLocaleString()} of{' '}
          {data.length.toLocaleString()} rows
        </div>
      </div>

      {/* Table container */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <>
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const sortDirection = header.column.getIsSorted();

                    return (
                      <th
                        key={header.id}
                        className={`px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap border-b border-gray-200 ${
                          canSort ? 'cursor-pointer select-none hover:bg-gray-200' : ''
                        }`}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && <SortIndicator direction={sortDirection} />}
                        </div>
                      </th>
                    );
                  })}
                </tr>
                {/* Filter row */}
                {showFilters && (
                  <tr key={`${headerGroup.id}-filter`} className="bg-gray-50">
                    {headerGroup.headers.map((header) => {
                      const meta = header.column.columnDef.meta as { isNumeric?: boolean } | undefined;
                      return (
                        <th key={`${header.id}-filter`} className="px-4 py-2 border-b border-gray-200">
                          {header.column.getCanFilter() && (
                            <ColumnFilter
                              column={header.column}
                              isNumeric={meta?.isNumeric}
                            />
                          )}
                        </th>
                      );
                    })}
                  </tr>
                )}
              </>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, idx) => (
              <tr
                key={row.id}
                className={`border-b border-gray-100 hover:bg-blue-50 transition-colors ${
                  idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'
                }`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-2 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Rows per page:</span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              className="px-2 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              aria-label="First page"
            >
              &#171;
            </button>
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-2 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              aria-label="Previous page"
            >
              &#8249;
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-2 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              aria-label="Next page"
            >
              &#8250;
            </button>
            <button
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              className="px-2 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              aria-label="Last page"
            >
              &#187;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
