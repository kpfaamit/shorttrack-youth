import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts';
import type { Skater } from '../../types/data';

interface Props {
  skaters: Skater[];
}

export default function TopOvertakersChart({ skaters }: Props) {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const sortedData = [...skaters]
    .sort((a, b) => (b.stats?.total_passes_made || 0) - (a.stats?.total_passes_made || 0))
    .slice(0, isMobile ? 10 : 20);

  // Mobile: simple table view
  if (isMobile) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-base font-bold text-gray-900 mb-3">
          Top 10 Overtakers
        </h2>
        <div className="space-y-2">
          {sortedData.map((s, i) => (
            <div key={s.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-gray-400 w-5">{i + 1}</span>
                <span className="text-sm">{s.flag}</span>
                <span className="text-sm font-medium truncate">{s.name}</span>
              </div>
              <div className="flex gap-3 text-xs flex-shrink-0">
                <span className="text-[#2646A7] font-semibold">+{(s.stats?.total_passes_made || 0)}</span>
                <span className="text-red-600 font-semibold">-{(s.stats?.total_times_passed || 0)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-4 mt-3 text-xs text-gray-500">
          <span><span className="inline-block w-2 h-2 bg-[#2646A7] rounded mr-1"></span>Passes Made</span>
          <span><span className="inline-block w-2 h-2 bg-red-600 rounded mr-1"></span>Times Passed</span>
        </div>
      </div>
    );
  }

  // Desktop: chart view  
  const data = sortedData
    .map((s) => ({
      name: `${s.flag} ${s.name}`,
      passesMade: s.stats?.total_passes_made || 0,
      timesPassed: s.stats?.total_times_passed || 0,
    }))
    .reverse();

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">
        Top 20 Overtakers
      </h2>
      <div style={{ height: 600 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 160, right: 20, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={150} />
            <Tooltip />
            <Legend />
            <Bar dataKey="passesMade" name="Passes Made" fill="#2646A7" radius={[0, 4, 4, 0]} />
            <Bar dataKey="timesPassed" name="Times Passed" fill="#DC2626" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
