import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  ReferenceLine,
} from 'recharts';
import type { Skater } from '../../types/data';

interface Props {
  skaters: Skater[];
}

export default function NetPassChart({ skaters }: Props) {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const sorted = [...skaters].sort((a, b) => (b.stats?.net_passes || 0) - (a.stats?.net_passes || 0));
  const topN = isMobile ? 5 : 10;
  const top = sorted.slice(0, topN);
  const bottom = sorted.slice(-topN).reverse();

  // Combine and dedupe
  const combined = [...top, ...bottom];
  const seen = new Set<string>();
  const uniqueData = combined.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });

  // Mobile: simple table view
  if (isMobile) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-base font-bold text-gray-900 mb-2">
          Best &amp; Worst Net Passes
        </h2>
        <p className="text-xs text-gray-500 mb-3">
          Green = gains more positions. Red = loses more.
        </p>
        <div className="space-y-1.5">
          {uniqueData.map((s) => (
            <div key={s.id} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm">{s.flag}</span>
                <span className="text-sm truncate">{s.name}</span>
              </div>
              <span className={`text-sm font-bold ${(s.stats?.net_passes || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {(s.stats?.net_passes || 0) > 0 ? '+' : ''}{s.stats?.net_passes || 0}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Desktop: chart view
  const data = uniqueData.map((s) => ({
    name: `${s.flag} ${s.name}`,
    net: s.stats?.net_passes || 0,
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">
        Best &amp; Worst Net Passes
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Net passes = passes made minus times passed. Green = gains more than loses. Red = opposite.
      </p>
      <div style={{ height: 400 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 160, right: 20, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={150} />
            <Tooltip formatter={(v) => [Number(v), 'Net Passes']} />
            <ReferenceLine x={0} stroke="#000" />
            <Bar dataKey="net" radius={[0, 4, 4, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.net >= 0 ? '#059669' : '#DC2626'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
