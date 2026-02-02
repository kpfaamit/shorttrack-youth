import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import type { Skater, Style } from '../../types/data';
import { STYLE_LABELS } from '../../types/data';

interface Props {
  skater: Skater;
}

const STYLE_COLORS: Record<Style, string> = {
  late_mover: 'bg-red-50 text-red-800 border-red-200',
  front_runner: 'bg-green-50 text-green-800 border-green-200',
  mid_surge: 'bg-amber-50 text-amber-800 border-amber-200',
  balanced: 'bg-blue-50 text-blue-800 border-blue-200',
  no_passes: 'bg-gray-100 text-gray-600 border-gray-200',
  developing: 'bg-purple-50 text-purple-800 border-purple-200',
  sprint: 'bg-cyan-50 text-cyan-800 border-cyan-200',
  unknown: 'bg-gray-100 text-gray-500 border-gray-200',
};

const TIMING_COLORS = ['#0891B2', '#D97706', '#DC2626'];

function MiniStat({ value, label, color }: { value: string | number; label: string; color?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <div className={`text-lg font-extrabold ${color || 'text-[#2646A7]'}`}>{value}</div>
      <div className="text-[11px] font-semibold text-gray-500 uppercase">{label}</div>
    </div>
  );
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function SkaterCard({ skater }: Props) {
  const s = skater.stats || {
    total_races: 0,
    finals_appearances: 0,
    medals: { gold: 0, silver: 0, bronze: 0, total: 0 },
    total_passes_made: 0,
    total_times_passed: 0,
    net_passes: 0,
    avg_passes_per_race: 0,
    style: 'unknown',
    passes_early: 0,
    passes_middle: 0,
    passes_late: 0,
  };

  // Timing doughnut data
  const timingData = [
    { name: 'Early', value: s.passes_early || 0 },
    { name: 'Middle', value: s.passes_middle || 0 },
    { name: 'Late', value: s.passes_late || 0 },
  ].filter((d) => d.value > 0);

  // Distance bar data
  const distData = skater.distances?.map((d) => ({
    distance: `${d.distance}m`,
    races: d.races,
  })) || [];

  const totalMedals = (s.medals?.gold || 0) + (s.medals?.silver || 0) + (s.medals?.bronze || 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-[#2646A7] text-white flex items-center justify-center text-lg font-extrabold shrink-0">
          {getInitials(skater.name)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl font-extrabold text-gray-900">
              {skater.flag} {skater.name}
            </span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STYLE_COLORS[s.style || 'unknown']}`}
            >
              {STYLE_LABELS[s.style || 'unknown']}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {skater.nationality} · {skater.gender} · {skater.category}
          </p>
        </div>
      </div>

      {/* Bio grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat value={skater.height ? `${skater.height}cm` : '—'} label="Height" />
        <MiniStat value={skater.age ?? '—'} label="Age" />
        <MiniStat value={s.total_races || 0} label="Races" />
        <MiniStat value={s.finals_appearances || 0} label="Finals" />
      </div>

      {/* Medals */}
      {totalMedals > 0 && (
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-gray-700">Medals:</span>
          {(s.medals?.gold || 0) > 0 && (
            <span className="text-sm">🥇 {s.medals.gold}</span>
          )}
          {(s.medals?.silver || 0) > 0 && (
            <span className="text-sm">🥈 {s.medals.silver}</span>
          )}
          {(s.medals?.bronze || 0) > 0 && (
            <span className="text-sm">🥉 {s.medals.bronze}</span>
          )}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat value={s.total_passes_made || 0} label="Passes Made" />
        <MiniStat value={s.total_times_passed || 0} label="Times Passed" color="text-red-600" />
        <MiniStat
          value={`${(s.net_passes || 0) > 0 ? '+' : ''}${s.net_passes || 0}`}
          label="Net Passes"
          color={(s.net_passes || 0) >= 0 ? 'text-green-700' : 'text-red-600'}
        />
        <MiniStat value={(s.avg_passes_per_race || 0).toFixed(1)} label="Avg / Race" />
      </div>

      {/* Discipline */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-2">Discipline</h3>
        <div className="grid grid-cols-3 gap-3">
          <MiniStat value={s.penalties ?? 0} label="Penalties" color="text-orange-600" />
          <MiniStat value={s.dnf ?? 0} label="DNF" color="text-red-600" />
          <MiniStat value={s.crashes_inferred ?? 0} label="Crashes" color="text-red-700" />
        </div>
      </div>

      {/* Events list */}
      {skater.events.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-700 mb-2">
            Events ({skater.events.length})
          </h3>
          <div className="space-y-2">
            {skater.events.map((ev) => (
              <div
                key={ev.event_id}
                className="bg-gray-50 rounded-lg p-3 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{ev.name}</div>
                  <div className="text-xs text-gray-500">
                    {ev.races} races · Best rank: {ev.best_rank ?? '—'}
                    {ev.finals_reached && ' · Finals ✓'}
                  </div>
                </div>
                {ev.medal && (
                  <span className="text-lg shrink-0">
                    {ev.medal === 'gold' ? '🥇' : ev.medal === 'silver' ? '🥈' : '🥉'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Distance chips */}
      {skater.distances.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-700 mb-2">Distances</h3>
          <div className="flex flex-wrap gap-2">
            {skater.distances.map((d) => (
              <span
                key={d.distance}
                className="bg-blue-50 text-blue-800 border border-blue-200 text-xs font-semibold px-3 py-1 rounded-full"
              >
                {d.distance}m — {d.races} races
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Mini charts row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Timing doughnut */}
        {timingData.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-2">Overtake Timing</h3>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={timingData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {timingData.map((_, i) => (
                      <Cell key={i} fill={TIMING_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Distance bar */}
        {distData.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-2">Races by Distance</h3>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="distance" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="races" fill="#2646A7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
