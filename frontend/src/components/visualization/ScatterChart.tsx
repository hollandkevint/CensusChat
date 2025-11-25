'use client';

import React from 'react';
import {
  ScatterChart as RechartsScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ZAxis
} from 'recharts';
import { formatColumnName, getChartColors } from './ChartSelector';

interface ScatterChartProps {
  data: any[];
  xKey: string;
  yKey: string;
  zKey?: string; // Optional size dimension
  nameKey?: string; // For labels
  title?: string;
}

export default function ScatterChart({ data, xKey, yKey, zKey, nameKey, title }: ScatterChartProps) {
  const colors = getChartColors();

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
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
          {nameKey && item[nameKey] && (
            <p className="font-semibold text-gray-900 dark:text-white mb-2">
              {item[nameKey]}
            </p>
          )}
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {formatColumnName(xKey)}: {Number(item[xKey]).toLocaleString()}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {formatColumnName(yKey)}: {Number(item[yKey]).toLocaleString()}
          </p>
          {zKey && item[zKey] && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {formatColumnName(zKey)}: {Number(item[zKey]).toLocaleString()}
            </p>
          )}
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
        <RechartsScatterChart
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis
            type="number"
            dataKey={xKey}
            name={formatColumnName(xKey)}
            tick={{ fontSize: 12, fill: '#6B7280' }}
            tickFormatter={formatValue}
            label={{
              value: formatColumnName(xKey),
              position: 'bottom',
              offset: 40,
              style: { fill: '#6B7280', fontSize: 12 }
            }}
          />
          <YAxis
            type="number"
            dataKey={yKey}
            name={formatColumnName(yKey)}
            tick={{ fontSize: 12, fill: '#6B7280' }}
            tickFormatter={formatValue}
            width={70}
            label={{
              value: formatColumnName(yKey),
              angle: -90,
              position: 'insideLeft',
              style: { fill: '#6B7280', fontSize: 12 }
            }}
          />
          {zKey && (
            <ZAxis
              type="number"
              dataKey={zKey}
              range={[50, 400]}
              name={formatColumnName(zKey)}
            />
          )}
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Scatter
            name={`${formatColumnName(xKey)} vs ${formatColumnName(yKey)}`}
            data={data}
            fill={colors[0]}
            fillOpacity={0.6}
          />
        </RechartsScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
