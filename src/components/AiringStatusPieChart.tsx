import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

export interface AiringStatusPieChartProps {
  data: Array<{ name: string; value: number; color: string }>;
}

export const AiringStatusPieChart: React.FC<AiringStatusPieChartProps> = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={75}
          paddingAngle={6}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ backgroundColor: '#0e1322', borderColor: '#272d3d', borderRadius: '12px', fontSize: '11px', color: '#fff' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};
