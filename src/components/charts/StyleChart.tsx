import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { Skater, Style } from '../../types/data';
import { STYLE_LABELS } from '../../types/data';

interface Props {
  skaters: Skater[];
}

const COLORS: Record<Style, string> = {
  late_mover: '#DC2626',
  front_runner: '#059669',
  mid_surge: '#D97706',
  balanced: '#2646A7',
  no_passes: '#64748B',
  developing: '#7C3AED',
  sprint: '#0891B2',
  unknown: '#94A3B8',
};

export default function StyleChart({ skaters }: Props) {
  const counts: Record<Style, number> = {
    late_mover: 0,
    front_runner: 0,
    mid_surge: 0,
    balanced: 0,
    no_passes: 0,
    developing: 0,
    sprint: 0,
    unknown: 0,
  };

  for (const s of skaters) {
    const style = s.stats?.style || 'unknown';
    counts[style]++;
  }

  const data = (Object.entries(counts) as [Style, number][])
    .filter(([, v]) => v > 0)
    .map(([styleKey, value]) => ({
      name: STYLE_LABELS[styleKey],
      value,
      styleKey,
    }));

  const total = data.reduce((s, d) => s + d.value, 0);

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Skater Styles</h2>
        <p className="text-gray-400 text-sm text-center py-8">No style data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">
        Skater Styles
      </h2>
      <div style={{ height: 350 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={120}
              dataKey="value"
              label={({ name, value }: { name?: string; value?: number }) =>
                `${name ?? ''}: ${total > 0 && value != null ? ((value / total) * 100).toFixed(0) : 0}%`
              }
            >
              {data.map((d) => (
                <Cell key={d.name} fill={COLORS[d.styleKey]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number | undefined) => [`${v ?? 0} Skaters`, '']}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
