'use client';

import React from 'react';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { formatColumnName, getChartColors } from './ChartSelector';

interface BarChartProps {
  data: any[];
  xKey: string;
  yKeys: string[];
  title?: string;
  stacked?: boolean;
}

export default function BarChart({ data, xKey, yKeys, title, stacked = false }: BarChartProps) {
  const colors = getChartColors();

  // Truncate long labels
  const truncateLabel = (label: string, maxLength: number = 15): string => {
    if (!label) return '';
    const str = String(label);
    return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
  };

  // Format large numbers
  const formatValue = (value: number): string => {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    return value.toLocaleString();
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
          <p className="font-semibold text-gray-900 dark:text-white mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {formatColumnName(entry.dataKey)}: {Number(entry.value).toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={350}>
        <RechartsBarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 12, fill: '#6B7280' }}
            tickFormatter={(value) => truncateLabel(value)}
            angle={-45}
            textAnchor="end"
            height={80}
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#6B7280' }}
            tickFormatter={formatValue}
            width={70}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={(value) => formatColumnName(value)}
          />
          {yKeys.map((key, index) => (
            <Bar
              key={key}
              dataKey={key}
              fill={colors[index % colors.length]}
              stackId={stacked ? 'stack' : undefined}
              radius={[4, 4, 0, 0]}
            >
              {data.map((_, cellIndex) => (
                <Cell
                  key={`cell-${cellIndex}`}
                  fill={colors[index % colors.length]}
                />
              ))}
            </Bar>
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
