import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface MintChartProps {
  mintHistory: Array<{
    timestamp: number;
    algoAmount: number;
    hstrkAmount: number;
    ratio: number;
    cumulativeStrk: number;
    cumulativeHstrk: number;
    type?: 'MINT' | 'REDEEM';
  }>;
  currentRatio: number;
}

interface ChartDataPoint {
  time: string;
  ratio: number;
  cumulativeStrk: number;
  cumulativeHstrk: number;
  timestamp: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: ChartDataPoint;
  }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white border border-black rounded-lg p-3 shadow-lg">
        <p className="text-black text-sm font-medium">{`Time: ${label}`}</p>
        <p className="text-black text-sm">
          <span className="text-black text-opacity-60">Mint Ratio:</span> {data.ratio.toFixed(4)}
        </p>
        <p className="text-black text-sm">
          <span className="text-black text-opacity-60">Total STRK:</span> {data.cumulativeStrk.toFixed(2)}
        </p>
        <p className="text-black text-sm">
          <span className="text-black text-opacity-60">Total hSTRK:</span> {data.cumulativeHstrk.toFixed(2)}
        </p>
      </div>
    );
  }
  return null;
};

const MintChart: React.FC<MintChartProps> = ({ mintHistory, currentRatio }) => {
  const [realTimeData, setRealTimeData] = React.useState<ChartDataPoint[]>([]);

  // Update chart data when new mint/redeem transactions occur
  React.useEffect(() => {
    if (mintHistory && mintHistory.length > 0) {
      const transformedData = mintHistory.map((entry) => ({
        time: new Date(entry.timestamp).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        ratio: entry.ratio,
        cumulativeStrk: entry.cumulativeStrk,
        cumulativeHstrk: entry.cumulativeHstrk,
        timestamp: entry.timestamp
      }));
      setRealTimeData(transformedData);
    }
  }, [mintHistory]);

  const chartData = useMemo(() => {
    if (realTimeData.length > 0) {
      return realTimeData;
    }
    if (!mintHistory || mintHistory.length === 0) {
      // Generate realistic sample data for demonstration when no real data exists
      const now = Date.now();
      const sampleData: ChartDataPoint[] = [];

      // Simulate realistic hSTRK mint ratio fluctuations
      let cumulativeStrk = 0;
      let cumulativeHstrk = 0;

      for (let i = 0; i < 48; i++) { // Last 48 hours for more data points
        const timestamp = now - (47 - i) * 30 * 60 * 1000; // Every 30 minutes

        // Base ratio around 1.0 with realistic market fluctuations
        const baseRatio = 1.0;
        const marketTrend = Math.sin(i * 0.1) * 0.005; // Long-term trend
        const volatility = (Math.random() - 0.5) * 0.002; // Short-term volatility
        const ratio = Math.max(0.995, Math.min(1.005, baseRatio + marketTrend + volatility));

        // Simulate trading activity
        const tradingVolume = 50 + Math.random() * 100; // 50-150 STRK per period
        cumulativeStrk += tradingVolume;
        cumulativeHstrk += tradingVolume * ratio;

        sampleData.push({
          time: new Date(timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          }),
          ratio: ratio,
          cumulativeStrk: cumulativeStrk,
          cumulativeHstrk: cumulativeHstrk,
          timestamp: timestamp
        });
      }

      return sampleData;
    }

    // Process real mint history data
    return mintHistory.map((entry) => ({
      time: new Date(entry.timestamp).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      ratio: entry.ratio,
      cumulativeStrk: entry.cumulativeStrk,
      cumulativeHstrk: entry.cumulativeHstrk,
      timestamp: entry.timestamp
    }));
  }, [mintHistory, realTimeData]);



  // Calculate 24H change
  const change24h = chartData.length > 1
    ? ((chartData[chartData.length - 1].ratio - chartData[0].ratio) / chartData[0].ratio * 100)
    : 0;

  const isPositive = change24h >= 0;

  return (
    <div className="bg-white border border-black rounded-3xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300">
      {/* Header with large value display */}
      <div className="mb-8">
        <div className="mb-6">
          <div className="text-5xl font-light text-black mb-2">
            {currentRatio.toFixed(4)}
          </div>
          <div className="text-sm text-black text-opacity-60 mb-2">
            Current Ratio
          </div>
          <div className={`text-lg font-medium ${isPositive ? 'text-[#fdc5fe]' : 'text-red-500'}`}>
            {isPositive ? '+' : ''}{change24h.toFixed(2)}% (24H)
          </div>
        </div>
      </div>
      
      <div className="h-96 w-full bg-white rounded-2xl p-6 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{
              top: 40,
              right: 40,
              left: 40,
              bottom: 40,
            }}
          >
            <XAxis
              dataKey="time"
              axisLine={false}
              tickLine={false}
              tick={false}
              height={0}
            />
            <YAxis
              domain={['dataMin - 0.001', 'dataMax + 0.001']}
              axisLine={false}
              tickLine={false}
              tick={false}
              width={0}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="ratio"
              stroke="#fdc5fe"
              strokeWidth={6}
              dot={false}
              activeDot={{ r: 0 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {/* Time Period Selector */}
      <div className="flex justify-center">
        <div className="bg-white border border-black rounded-full p-1 flex">
          {['24H', '7D', '1M'].map((period, index) => (
            <button
              key={period}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                index === 0
                  ? 'bg-black text-white'
                  : 'text-black hover:bg-gray-50'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MintChart;
