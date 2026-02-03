/**
 * LineChart Component
 * Recharts-based line chart for trend/time-series visualization
 */

import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

/**
 * Color palette for chart lines
 * Professional colors with good contrast
 */
const COLORS = [
  '#8884d8', // Purple
  '#82ca9d', // Green
  '#ffc658', // Yellow
  '#ff7c43', // Orange
  '#a4de6c', // Lime
  '#d0ed57', // Chartreuse
  '#8dd1e1', // Cyan
  '#ff8042', // Coral
];

export interface LineChartProps {
  data: Record<string, unknown>[];
  xAxisKey: string;
  yAxisKeys: string[];
  title?: string;
  showDots?: boolean;
  onPointClick?: (data: Record<string, unknown>) => void;
}

/**
 * Format axis tick labels
 * Handles time values and numbers
 */
function formatAxisLabel(value: unknown, maxLength: number = 15): string {
  if (typeof value === 'number') {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toLocaleString();
  }

  const str = String(value);
  if (str.length > maxLength) {
    return str.substring(0, maxLength - 3) + '...';
  }
  return str;
}

/**
 * Format tooltip values
 */
function formatTooltipValue(value: number | string): string {
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  return String(value);
}

/**
 * Custom tooltip content
 */
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 shadow-lg rounded-lg p-3 text-sm">
      <p className="font-semibold text-gray-800 mb-2">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-gray-600" style={{ color: entry.color }}>
          <span className="font-medium">{entry.name}:</span>{' '}
          {formatTooltipValue(entry.value)}
        </p>
      ))}
    </div>
  );
}

/**
 * Interactive line chart component
 */
export function LineChart({
  data,
  xAxisKey,
  yAxisKeys,
  title,
  showDots = true,
  onPointClick,
}: LineChartProps) {
  // Determine dot display based on data density
  const shouldShowDots = showDots && data.length <= 50;

  const handleClick = (data: Record<string, unknown>) => {
    if (onPointClick) {
      onPointClick(data);
    }
  };

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">
          {title}
        </h3>
      )}

      <div className="min-h-[400px] w-full">
        <ResponsiveContainer width="100%" height={400}>
          <RechartsLineChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            onClick={(e) => {
              const payload = (e as { activePayload?: Array<{ payload: Record<string, unknown> }> })?.activePayload?.[0]?.payload;
              if (payload) handleClick(payload);
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

            <XAxis
              dataKey={xAxisKey}
              tick={{ fontSize: 12, fill: '#4b5563' }}
              tickFormatter={(value) => formatAxisLabel(value, 12)}
              angle={-45}
              textAnchor="end"
              height={80}
            />

            <YAxis
              tick={{ fontSize: 12, fill: '#4b5563' }}
              tickFormatter={(value) => formatAxisLabel(value)}
              width={80}
            />

            <Tooltip content={<CustomTooltip />} />

            <Legend
              wrapperStyle={{ paddingTop: 10 }}
              formatter={(value) => (
                <span className="text-gray-700 text-sm">{value}</span>
              )}
            />

            {yAxisKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={key}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={2}
                dot={shouldShowDots ? { r: 4 } : false}
                activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                cursor={onPointClick ? 'pointer' : undefined}
              />
            ))}
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default LineChart;
