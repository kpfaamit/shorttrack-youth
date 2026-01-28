import { useState, useMemo } from 'react';
import type { Skater, Category, Gender } from '../types/data';
import { STYLE_LABELS } from '../types/data';
import FilterBar from '../components/forms/FilterBar';
import MethodologyCard from '../components/cards/MethodologyCard';

interface Props {
  skaters: Skater[];
  category: Category | 'all';
}

type LeaderboardType = 
  | 'threat_score' 
  | 'total_races' 
  | 'medals' 
  | 'net_passes' 
  | 'avg_passes' 
  | 'finals'
  | 'pb_500'
  | 'pb_1000'
  | 'pb_1500'
  | 'clean_race';

interface LeaderboardConfig {
  key: LeaderboardType;
  label: string;
  emoji: string;
  getValue: (s: Skater) => number | null;
  format: (v: number) => string;
  higherIsBetter: boolean;
  minValue?: number;
}

function parseTimeToSeconds(t: string | undefined | null): number | null {
  if (!t) return null;
  const s = t.trim();
  if (s.includes(':')) {
    const [mins, secs] = s.split(':');
    return parseFloat(mins) * 60 + parseFloat(secs);
  }
  const v = parseFloat(s);
  return isNaN(v) ? null : v;
}

const LEADERBOARD_CONFIGS: LeaderboardConfig[] = [
  {
    key: 'threat_score',
    label: 'Threat Score',
    emoji: '⚔️',
    getValue: (s) => s.stats.threat_score,
    format: (v) => v.toFixed(1),
    higherIsBetter: true,
  },
  {
    key: 'medals',
    label: 'Total Medals',
    emoji: '🏅',
    getValue: (s) => s.stats.medals.total,
    format: (v) => v.toString(),
    higherIsBetter: true,
  },
  {
    key: 'finals',
    label: 'Finals Appearances',
    emoji: '🏆',
    getValue: (s) => s.stats.finals_appearances,
    format: (v) => v.toString(),
    higherIsBetter: true,
  },
  {
    key: 'total_races',
    label: 'Total Races',
    emoji: '🏁',
    getValue: (s) => s.stats.total_races,
    format: (v) => v.toString(),
    higherIsBetter: true,
  },
  {
    key: 'net_passes',
    label: 'Net Passes',
    emoji: '📈',
    getValue: (s) => s.stats.net_passes,
    format: (v) => (v > 0 ? '+' : '') + v.toString(),
    higherIsBetter: true,
  },
  {
    key: 'avg_passes',
    label: 'Avg Passes/Race',
    emoji: '💨',
    getValue: (s) => s.stats.avg_passes_per_race,
    format: (v) => v.toFixed(2),
    higherIsBetter: true,
  },
  {
    key: 'clean_race',
    label: 'Clean Race %',
    emoji: '✨',
    getValue: (s) => s.stats.clean_race_pct * 100,
    format: (v) => v.toFixed(1) + '%',
    higherIsBetter: true,
    minValue: 5, // Need at least 5 races
  },
  {
    key: 'pb_500',
    label: '500m Personal Best',
    emoji: '⚡',
    getValue: (s) => parseTimeToSeconds(s.personal_bests?.['500']),
    format: (v) => {
      if (v >= 60) {
        const mins = Math.floor(v / 60);
        const secs = (v % 60).toFixed(3);
        return `${mins}:${secs.padStart(6, '0')}`;
      }
      return v.toFixed(3);
    },
    higherIsBetter: false,
  },
  {
    key: 'pb_1000',
    label: '1000m Personal Best',
    emoji: '🔥',
    getValue: (s) => parseTimeToSeconds(s.personal_bests?.['1000']),
    format: (v) => {
      const mins = Math.floor(v / 60);
      const secs = (v % 60).toFixed(3);
      return `${mins}:${secs.padStart(6, '0')}`;
    },
    higherIsBetter: false,
  },
  {
    key: 'pb_1500',
    label: '1500m Personal Best',
    emoji: '🚀',
    getValue: (s) => parseTimeToSeconds(s.personal_bests?.['1500']),
    format: (v) => {
      const mins = Math.floor(v / 60);
      const secs = (v % 60).toFixed(3);
      return `${mins}:${secs.padStart(6, '0')}`;
    },
    higherIsBetter: false,
  },
];

const RANK_STYLES = [
  'bg-yellow-400 text-yellow-900', // 1st - Gold
  'bg-gray-300 text-gray-800',     // 2nd - Silver
  'bg-amber-600 text-white',       // 3rd - Bronze
];

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    const emoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
    return (
      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${RANK_STYLES[rank - 1]}`}>
        {emoji}
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-semibold text-gray-600 text-sm">
      {rank}
    </div>
  );
}

export default function Leaderboards({ skaters, category }: Props) {
  const [activeBoard, setActiveBoard] = useState<LeaderboardType>('threat_score');
  const [gender, setGender] = useState<Gender | 'all'>('all');
  const [nationality, setNationality] = useState<string | 'all'>('all');
  const [distance, setDistance] = useState<number | 'all'>('all');

  const config = LEADERBOARD_CONFIGS.find((c) => c.key === activeBoard)!;

  // Get nationalities from filtered skaters
  const nationalities = useMemo(() => {
    const cats = category === 'all' ? skaters : skaters.filter((s) => s.category === category);
    const nats = new Set(cats.map((s) => s.nationality));
    return [...nats].sort();
  }, [skaters, category]);

  // Apply filters and sort
  const rankedSkaters = useMemo(() => {
    let filtered = category === 'all' 
      ? skaters 
      : skaters.filter((s) => s.category === category);

    if (gender !== 'all') {
      filtered = filtered.filter((s) => s.gender.toLowerCase() === gender.toLowerCase());
    }

    if (nationality !== 'all') {
      filtered = filtered.filter((s) => s.nationality === nationality);
    }

    // Min races filter for certain boards
    if (config.minValue) {
      filtered = filtered.filter((s) => s.stats.total_races >= config.minValue!);
    }

    // Get value and filter out nulls
    const withValues = filtered
      .map((s) => ({ skater: s, value: config.getValue(s) }))
      .filter((item): item is { skater: Skater; value: number } => item.value !== null);

    // Sort
    withValues.sort((a, b) => {
      if (config.higherIsBetter) {
        return b.value - a.value;
      }
      return a.value - b.value;
    });

    return withValues.slice(0, 50);
  }, [skaters, category, gender, nationality, config]);

  // Stats summary
  const summary = useMemo(() => {
    if (rankedSkaters.length === 0) return null;
    const values = rankedSkaters.map((r) => r.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const top = values[0];
    return { count: rankedSkaters.length, avg, top };
  }, [rankedSkaters]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">🏆 Leaderboards</h1>
        <p className="text-gray-500 mt-1">
          Top performers across all metrics. Filter by category, gender, or country.
        </p>
      </div>

      {/* Filters */}
      <FilterBar
        gender={gender}
        onGenderChange={setGender}
        distance={distance}
        onDistanceChange={setDistance}
        nationality={nationality}
        onNationalityChange={setNationality}
        nationalities={nationalities}
      />

      {/* Leaderboard Type Selector */}
      <div className="flex flex-wrap gap-2">
        {LEADERBOARD_CONFIGS.map((cfg) => (
          <button
            key={cfg.key}
            onClick={() => setActiveBoard(cfg.key)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              activeBoard === cfg.key
                ? 'bg-[#2646A7] text-white shadow-md'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-[#2646A7] hover:text-[#2646A7]'
            }`}
          >
            {cfg.emoji} {cfg.label}
          </button>
        ))}
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl font-extrabold text-[#2646A7]">{summary.count}</div>
            <div className="text-xs font-semibold text-gray-500 uppercase">Skaters</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl font-extrabold text-green-600">{config.format(summary.top)}</div>
            <div className="text-xs font-semibold text-gray-500 uppercase">Best</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl font-extrabold text-gray-700">{config.format(summary.avg)}</div>
            <div className="text-xs font-semibold text-gray-500 uppercase">Average</div>
          </div>
        </div>
      )}

      {/* Leaderboard Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            {config.emoji} {config.label}
            <span className="text-sm font-normal text-gray-500">
              ({config.higherIsBetter ? 'Higher is better' : 'Lower is better'})
            </span>
          </h2>
        </div>

        {rankedSkaters.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No skaters match the current filters
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rankedSkaters.map(({ skater, value }, idx) => (
              <div
                key={skater.id}
                className={`px-6 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors ${
                  idx < 3 ? 'bg-gradient-to-r from-yellow-50/50 to-transparent' : ''
                }`}
              >
                <RankBadge rank={idx + 1} />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{skater.flag}</span>
                    <span className="font-bold text-gray-900 truncate">
                      {skater.name}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                    <span>{skater.nationality}</span>
                    <span>•</span>
                    <span>{skater.gender}</span>
                    <span>•</span>
                    <span className="text-[#2646A7]">{STYLE_LABELS[skater.stats.style]}</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className={`text-xl font-extrabold ${
                    idx === 0 ? 'text-yellow-600' : 
                    idx === 1 ? 'text-gray-600' : 
                    idx === 2 ? 'text-amber-700' : 
                    'text-[#2646A7]'
                  }`}>
                    {config.format(value)}
                  </div>
                  {config.key !== 'total_races' && (
                    <div className="text-xs text-gray-400">
                      {skater.stats.total_races} races
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Country Breakdown */}
      <CountryBreakdown skaters={rankedSkaters.map(r => r.skater)} />

      {/* Methodology */}
      <MethodologyCard
        title="Leaderboards — Metric Definitions"
        intro="Rankings are computed from ISU World Tour and Junior World Cup data for the 2025-2026 season. Filters are applied before ranking."
        metrics={[
          { term: 'Threat Score', definition: '0–100 composite reflecting pass rate, net passes, finals rate, and medal count. Measures overall competitive danger.' },
          { term: 'Total Medals', definition: 'Sum of gold, silver, and bronze medals from Final A podium finishes (ranks 1–3).' },
          { term: 'Finals Appearances', definition: 'Number of times the skater advanced to Final A or Final B heats across all events.' },
          { term: 'Total Races', definition: 'Count of all individual heat appearances across the season.' },
          { term: 'Net Passes', definition: 'Passes Made − Times Passed. Positive = net overtaker.' },
          { term: 'Avg Passes/Race', definition: 'Total passes made divided by total races. Measures overtaking frequency.' },
          { term: 'Clean Race %', definition: 'Percentage of races with no penalties, DNF, or DNS. Requires ≥5 races.' },
          { term: 'Personal Bests', definition: 'Fastest recorded time for each distance. Lower times rank higher.' },
        ]}
      />
    </div>
  );
}

// Country Breakdown Component
function CountryBreakdown({ skaters }: { skaters: Skater[] }) {
  const countryStats = useMemo(() => {
    const stats = new Map<string, { flag: string; count: number; medals: number }>();
    
    for (const s of skaters) {
      const existing = stats.get(s.nationality) || { flag: s.flag, count: 0, medals: 0 };
      existing.count++;
      existing.medals += s.stats.medals.total;
      stats.set(s.nationality, existing);
    }

    return [...stats.entries()]
      .map(([nat, data]) => ({ nationality: nat, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [skaters]);

  if (countryStats.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">🌍 Country Breakdown</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {countryStats.map((c) => (
          <div
            key={c.nationality}
            className="text-center p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="text-2xl mb-1">{c.flag}</div>
            <div className="font-bold text-gray-900">{c.nationality}</div>
            <div className="text-sm text-gray-500">{c.count} skaters</div>
            {c.medals > 0 && (
              <div className="text-xs text-yellow-600 font-semibold">{c.medals} 🏅</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
