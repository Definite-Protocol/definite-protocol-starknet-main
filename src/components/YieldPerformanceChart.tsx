import React from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { ChartDataPoint } from '../types';

interface YieldPerformanceChartProps {
  data: ChartDataPoint[];
  loading?: boolean;
  height?: number;
}

const YieldPerformanceChart: React.FC<YieldPerformanceChartProps> = ({ 
  data, 
  loading = false, 
  height = 260 
}) => {
  if (loading) {
    return (
      <div className="h-64 bg-white bg-opacity-5 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6e6aff]"></div>
        <span className="text-white text-opacity-50 ml-4">Loading performance data...</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-64 bg-white bg-opacity-5 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-opacity-50 text-lg mb-2">No Data Available</div>
          <div className="text-white text-opacity-30 text-sm">Start investing to see your yield performance</div>
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; payload: { apy?: number } }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-black bg-opacity-90 backdrop-blur-sm p-4 border border-[#6e6aff] border-opacity-50 rounded-lg">
          <p className="text-white text-sm mb-2">{`Date: ${label}`}</p>
          <p className="text-[#6e6aff] text-sm">
            {`Yield: $${payload[0].value.toLocaleString()}`}
          </p>
          {payload[0].payload.apy && (
            <p className="text-white text-opacity-60 text-xs">
              {`APY: ${payload[0].payload.apy.toFixed(2)}%`}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const formatYAxis = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value}`;
  };

  return (
    <div className="h-full">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={data}
          margin={{
            top: 10,
            right: 30,
            left: 0,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient id="yieldGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6e6aff" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#6e6aff" stopOpacity={0.05} />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge> 
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="rgba(255,255,255,0.1)"
            vertical={false}
          />
          
          <XAxis 
            dataKey="date" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
            interval="preserveStartEnd"
          />
          
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
            tickFormatter={formatYAxis}
          />
          
          <Tooltip content={<CustomTooltip />} />
          
          <Area
            type="monotone"
            dataKey="value"
            stroke="#6e6aff"
            strokeWidth={3}
            fill="url(#yieldGradient)"
            filter="url(#glow)"
            strokeLinecap="round"
          />
          
          <Line
            type="monotone"
            dataKey="value"
            stroke="#6e6aff"
            strokeWidth={3}
            dot={{ fill: '#6e6aff', strokeWidth: 2, stroke: 'white', r: 4 }}
            activeDot={{ r: 6, fill: '#6e6aff', stroke: 'white', strokeWidth: 3 }}
            filter="url(#glow)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default YieldPerformanceChart;