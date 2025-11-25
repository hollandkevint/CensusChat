'use client';

import React, { useRef, useState, useMemo } from 'react';
import {
  ChartType,
  selectChartType,
  selectAxes,
  formatColumnName,
  ChartRecommendation
} from './ChartSelector';
import BarChart from './BarChart';
import LineChart from './LineChart';
import PieChart from './PieChart';
import ScatterChart from './ScatterChart';
import ExportControls from './ExportControls';
import { BarChart2, LineChartIcon, PieChartIcon, ScatterChartIcon, Table } from 'lucide-react';

interface DataVisualizationProps {
  data: any[];
  queryIntent?: string;
  title?: string;
  showControls?: boolean;
  className?: string;
}

const chartIcons: Record<ChartType, React.ReactNode> = {
  bar: <BarChart2 className="w-4 h-4" />,
  line: <LineChartIcon className="w-4 h-4" />,
  pie: <PieChartIcon className="w-4 h-4" />,
  scatter: <ScatterChartIcon className="w-4 h-4" />,
  table: <Table className="w-4 h-4" />,
};

export default function DataVisualization({
  data,
  queryIntent,
  title,
  showControls = true,
  className = ''
}: DataVisualizationProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  // Auto-select chart type
  const recommendation = useMemo(() => selectChartType(data, queryIntent), [data, queryIntent]);

  // Allow manual override
  const [selectedType, setSelectedType] = useState<ChartType>(recommendation.type);
  const [showTable, setShowTable] = useState(false);

  // Get axis configuration
  const { xKey, yKeys } = useMemo(() => selectAxes(data), [data]);

  // Available chart types for this data
  const availableTypes: ChartType[] = useMemo(() => {
    const types: ChartType[] = ['table'];

    if (data.length > 0 && data.length <= 100) {
      types.push('bar');

      // Line chart for time series or ordered data
      if (data.length >= 3) {
        types.push('line');
      }

      // Pie chart for small categorical data
      if (data.length <= 10) {
        types.push('pie');
      }

      // Scatter for correlation
      if (yKeys.length >= 2 && data.length >= 5) {
        types.push('scatter');
      }
    }

    return types;
  }, [data, yKeys]);

  // Don't render if no data
  if (!data || data.length === 0) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 py-8">
        No data available for visualization
      </div>
    );
  }

  // Render the appropriate chart
  const renderChart = () => {
    // Always show table if selected or if data is too large
    if (selectedType === 'table' || showTable) {
      return null; // Table is rendered separately in ChatInterface
    }

    const chartTitle = title || `${formatColumnName(yKeys[0])} by ${formatColumnName(xKey)}`;

    switch (selectedType) {
      case 'bar':
        return (
          <BarChart
            data={data}
            xKey={xKey}
            yKeys={yKeys}
            title={chartTitle}
          />
        );

      case 'line':
        return (
          <LineChart
            data={data}
            xKey={xKey}
            yKeys={yKeys}
            title={chartTitle}
          />
        );

      case 'pie':
        return (
          <PieChart
            data={data}
            nameKey={xKey}
            valueKey={yKeys[0]}
            title={chartTitle}
          />
        );

      case 'scatter':
        return (
          <ScatterChart
            data={data}
            xKey={yKeys[0]}
            yKey={yKeys[1] || yKeys[0]}
            zKey={yKeys[2]}
            nameKey={xKey}
            title={chartTitle}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Controls */}
      {showControls && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">View as:</span>
            <div className="flex gap-1">
              {availableTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setSelectedType(type);
                    setShowTable(type === 'table');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    selectedType === type
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title={`View as ${type} chart`}
                >
                  {chartIcons[type]}
                  <span className="hidden sm:inline capitalize">{type}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Chart recommendation badge */}
          {recommendation.type !== 'table' && (
            <div className="hidden md:flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                Recommended: {recommendation.type}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Chart Area */}
      {selectedType !== 'table' && (
        <div ref={chartRef} className="p-4">
          {renderChart()}

          {/* Export controls */}
          {showControls && (
            <div className="flex justify-end">
              <ExportControls chartRef={chartRef} filename="census-visualization" />
            </div>
          )}
        </div>
      )}

      {/* Data summary */}
      {selectedType !== 'table' && (
        <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
          Showing {data.length} records • X: {formatColumnName(xKey)} • Y: {yKeys.map(formatColumnName).join(', ')}
        </div>
      )}
    </div>
  );
}
