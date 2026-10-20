import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Sparkles, Tv, CheckCircle2, Clock } from 'lucide-react';
import { Anime } from './CatalogView';

export interface AiringStatusRatioWidgetProps {
  catalogList: Anime[];
}

export const AiringStatusRatioWidget: React.FC<AiringStatusRatioWidgetProps> = ({
  catalogList
}) => {
  const totalCount = catalogList.length || 1;
  const completedCount = catalogList.filter(a => (a.status || '').toLowerCase() !== 'airing').length;
  const ongoingCount = catalogList.filter(a => (a.status || '').toLowerCase() === 'airing').length;

  const data = [
    { name: 'Completed', value: completedCount, color: '#10b981' },
    { name: 'Ongoing (Airing)', value: ongoingCount, color: '#f59e0b' }
  ];

  const completedPct = Math.round((completedCount / totalCount) * 100);
  const ongoingPct = Math.round((ongoingCount / totalCount) * 100);

  return (
    <div className="max-w-6xl mx-auto px-4 my-8 font-sans">
      
      {/* CARD WRAPPER */}
      <div className="p-6 rounded-3xl bg-[#131926]/80 border border-white/10 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        
        {/* BLUR ELEMENT */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* TOP SECTION */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="font-heading font-black text-lg text-white tracking-tight">
              Live Database Status & Airing Ratios
            </h3>
          </div>

          <div className="flex items-center gap-6 bg-white/5 border border-white/5 rounded-2xl px-4 py-2.5 shadow-inner">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-neutral-300">{completedCount} Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-neutral-300">{ongoingCount} Ongoing</span>
            </div>
          </div>
        </div>

        {/* BOTTOM GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center mt-6 pt-6 border-t border-white/5">
          
          {/* LEFT COLUMN (CHART) */}
          <div className="h-[180px] w-full relative md:col-span-1 flex items-center justify-center">
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

            {/* ABSOLUTE CENTERED TOTAL ANIME COUNT LABEL */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
              <span className="font-heading font-black text-2xl text-white">{catalogList.length}</span>
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Total Titles</span>
            </div>
          </div>

          {/* RIGHT COLUMN (PROGRESS BARS) */}
          <div className="md:col-span-2 space-y-4">
            
            {/* Completed Progress */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-neutral-200">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Completed Series & Movies</span>
                </span>
                <span className="text-emerald-400">{completedCount} ({completedPct}%)</span>
              </div>
              <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-1000"
                  style={{ width: `${completedPct}%` }}
                />
              </div>
            </div>

            {/* Ongoing Progress */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-neutral-200">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Ongoing Simulcasts (Airing Now)</span>
                </span>
                <span className="text-amber-400">{ongoingCount} ({ongoingPct}%)</span>
              </div>
              <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                <div 
                  className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-1000"
                  style={{ width: `${ongoingPct}%` }}
                />
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
