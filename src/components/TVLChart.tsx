import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartDataPoint } from '../types';

interface TVLChartProps {
  data: ChartDataPoint[];
  loading?: boolean;
  title?: string;
  height?: number;
  theme?: 'dark' | 'light';
}

const TVLChart: React.FC<TVLChartProps> = ({
  data,
  loading = false,
  title = "Total Value Locked",
  height = 160,
  theme = 'dark'
}) => {
  const isLight = theme === 'light';
  if (loading) {
    return (
      <div style={{ height }} className={`flex items-center justify-center ${isLight ? 'bg-gray-50' : 'bg-white bg-opacity-5'}`}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#6e6aff]"></div>
        <span className={`ml-4 text-sm ${isLight ? 'text-black text-opacity-50' : 'text-white text-opacity-50'}`}>Loading {title.toLowerCase()}...</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div style={{ height }} className={`flex items-center justify-center ${isLight ? 'bg-gray-50' : 'bg-white bg-opacity-5'}`}>
        <div className="text-center">
          <div className={`text-sm mb-1 ${isLight ? 'text-black text-opacity-60' : 'text-white text-opacity-50'}`}>No {title} Data</div>
          <div className={`text-xs ${isLight ? 'text-black text-opacity-40' : 'text-white text-opacity-30'}`}>Data will appear as protocol grows</div>
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className={`backdrop-blur-sm p-3 border rounded ${
          isLight
            ? 'bg-white border-black shadow-lg'
            : 'bg-black bg-opacity-90 border-[#6e6aff] border-opacity-50'
        }`}>
          <p className={`text-xs mb-1 ${isLight ? 'text-black' : 'text-white'}`}>{`${label}`}</p>
          <p className="text-[#6e6aff] text-sm">
            {`$${payload[0].value.toLocaleString()}`}
          </p>
        </div>
      );
    }
    return null;
  };

  const formatYAxis = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K`;
    }
    return `${value}`;
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={data}
        margin={{
          top: 5,
          right: 10,
          left: 5,
          bottom: 5,
        }}
      >
        <defs>
          <linearGradient id="tvlAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6e6aff" stopOpacity={0.8} />
            <stop offset="100%" stopColor="#6e6aff" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}
          vertical={false}
        />

        <XAxis
          dataKey="date"
          axisLine={false}
          tickLine={false}
          tick={{ fill: isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)', fontSize: 10 }}
          interval="preserveStartEnd"
        />

        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)', fontSize: 10 }}
          tickFormatter={formatYAxis}
        />
        
        <Tooltip content={<CustomTooltip />} />
        
        <Area
          type="monotone"
          dataKey="value"
          stroke="#6e6aff"
          strokeWidth={2}
          fill="url(#tvlAreaGradient)"
          strokeLinecap="round"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default TVLChart;