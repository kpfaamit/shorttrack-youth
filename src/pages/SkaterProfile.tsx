import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import type { Skater } from '../types/data';
import { STYLE_LABELS, CATEGORY_LABELS } from '../types/data';

interface TimeTrendEntry {
  distance: number;
  time: number;
  time_str: string;
  competition: string;
  date: string | null;
  place: number | null;
  source: 'uss' | 'stl';
}

interface TimeTrendsData {
  generated: string;
  total_skaters: number;
  trends: Record<string, Record<number, TimeTrendEntry[]>>;
}

interface Props {
  skaters: Skater[];
  timeTrends: TimeTrendsData | null;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  if (mins > 0) {
    return `${mins}:${secs.padStart(6, '0')}`;
  }
  return secs;
}

function cleanEventName(name: string): string {
  // Remove "(slug-X)" suffixes from event names
  return name.replace(/\s*\(slug-\d+\)\s*/g, '').trim();
}

const DISTANCE_COLORS: Record<number, string> = {
  500: '#2646A7',
  1000: '#059669',
  1500: '#D97706',
};

const CHART_COLORS = {
  blue: '#2646A7',
  gold: '#D97706',
  red: '#DC2626',
  green: '#059669',
};

const SAVED_SKATER_KEY = 'shorttrack_my_skater';

export default function SkaterProfile({ skaters, timeTrends }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSkater, setSelectedSkater] = useState<Skater | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  // Load saved skater on mount
  useEffect(() => {
    const savedId = localStorage.getItem(SAVED_SKATER_KEY);
    if (savedId && skaters.length > 0) {
      const found = skaters.find(s => s.id === savedId);
      if (found) {
        setSelectedSkater(found);
        setIsSaved(true);
      }
    }
  }, [skaters]);

  // Check if current skater is saved
  useEffect(() => {
    if (selectedSkater) {
      const savedId = localStorage.getItem(SAVED_SKATER_KEY);
      setIsSaved(savedId === selectedSkater.id);
    }
  }, [selectedSkater]);

  const handleSaveSkater = () => {
    if (selectedSkater) {
      localStorage.setItem(SAVED_SKATER_KEY, selectedSkater.id);
      setIsSaved(true);
    }
  };

  const handleUnsaveSkater = () => {
    localStorage.removeItem(SAVED_SKATER_KEY);
    setIsSaved(false);
  };

  // Search results - search across ALL skaters (no category filter)
  // Handles both "daniel chen" and "CHEN Daniel" formats
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const queryParts = searchQuery.toLowerCase().split(/\s+/).filter(p => p.length > 0);
    
    return skaters
      .filter((s) => {
        const nameLower = s.name.toLowerCase();
        // Match if ALL query parts are found anywhere in the name
        return queryParts.every(part => nameLower.includes(part));
      })
      .slice(0, 20);
  }, [skaters, searchQuery]);

  // Get time trend data from pre-computed USS+STL merged data
  const timeTrendData = useMemo(() => {
    if (!selectedSkater || !timeTrends) return {};
    
    const skaterId = selectedSkater.id;
    const skaterTrends = timeTrends.trends[skaterId];
    if (!skaterTrends) return {};
    
    const byDistance: Record<number, { date: Date; time: number; competition: string; dateStr: string; source: string }[]> = {};
    
    for (const [distStr, entries] of Object.entries(skaterTrends)) {
      const dist = parseInt(distStr);
      byDistance[dist] = [];
      
      for (const entry of entries) {
        if (!entry.date) continue;
        
        try {
          const date = new Date(entry.date);
          if (!isNaN(date.getTime())) {
            byDistance[dist].push({
              date,
              time: entry.time,
              competition: entry.competition,
              dateStr: entry.date.split('T')[0],
              source: entry.source,
            });
          }
        } catch {
          // Skip invalid data
        }
      }
      
      byDistance[dist].sort((a, b) => a.date.getTime() - b.date.getTime());
    }
    
    return byDistance;
  }, [selectedSkater, timeTrends]);

  // Overtake style data (from Progress page)
  const overtakeStyleData = useMemo(() => {
    if (!selectedSkater) return [];
    const s = selectedSkater.stats;
    return [
      { name: 'Early', value: s.passes_early, fill: CHART_COLORS.blue },
      { name: 'Middle', value: s.passes_middle, fill: CHART_COLORS.gold },
      { name: 'Late', value: s.passes_late, fill: CHART_COLORS.red },
    ];
  }, [selectedSkater]);

  // Distance performance data
  const distanceData = useMemo(() => {
    if (!selectedSkater) return [];
    return selectedSkater.distances.map((d) => ({
      distance: `${d.distance}m`,
      races: d.races,
    }));
  }, [selectedSkater]);

  const handleSelectSkater = (skater: Skater) => {
    setSelectedSkater(skater);
    setSearchQuery('');
  };

  const medalEmoji = (medal: string | null) => {
    if (!medal) return '—';
    const lower = medal.toLowerCase();
    if (lower === 'gold') return '🥇';
    if (lower === 'silver') return '🥈';
    if (lower === 'bronze') return '🥉';
    return medal;
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span>👤</span> Skater Profile
        </h1>
        <p className="text-gray-600 mt-1">
          Search for a skater to view their stats and performance trends
        </p>
      </div>

      {/* Search Box */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search skater by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-md px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
        {searchResults.length > 0 && (
          <div className="absolute z-10 w-full max-w-md mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
            {searchResults.map((skater) => (
              <button
                key={skater.id}
                onClick={() => handleSelectSkater(skater)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b border-gray-100 last:border-b-0"
              >
                <span className="text-xl">{skater.flag}</span>
                <div>
                  <div className="font-medium">{skater.name}</div>
                  <div className="text-sm text-gray-500">
                    {skater.nationality} • {CATEGORY_LABELS[skater.category] || skater.category}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Skater Info */}
      {selectedSkater && (
        <div className="space-y-6">
          {/* Skater Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start gap-4">
              <div className="text-5xl">{selectedSkater.flag}</div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900">{selectedSkater.name}</h2>
                <p className="text-gray-600">{selectedSkater.nationality}</p>
              </div>
              <div className="flex items-center gap-2">
                {selectedSkater.stats.style && (
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    selectedSkater.stats.style === 'sprint' ? 'bg-green-100 text-green-800' :
                    selectedSkater.stats.style === 'balanced' ? 'bg-purple-100 text-purple-800' :
                    selectedSkater.stats.style === 'mid_surge' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {STYLE_LABELS[selectedSkater.stats.style] || selectedSkater.stats.style}
                  </span>
                )}
                {/* Save/Unsave button */}
                <button
                  onClick={isSaved ? handleUnsaveSkater : handleSaveSkater}
                  className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                    isSaved 
                      ? 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200' 
                      : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
                  }`}
                  title={isSaved ? 'Remove as my skater' : 'Save as my skater'}
                >
                  {isSaved ? '⭐ My Skater' : '☆ Save'}
                </button>
                {/* Race Prep link */}
                <Link
                  to="/"
                  className="px-3 py-1 rounded-full text-sm font-medium bg-[#2646A7] text-white hover:bg-[#1d3a8a] transition-colors"
                >
                  🎯 Race Prep
                </Link>
              </div>
            </div>

            {/* Info Grid - Compact */}
            <div className="mt-4 grid grid-cols-4 md:grid-cols-8 gap-2">
              <InfoItem label="Age" value={selectedSkater.age?.toString() || '—'} />
              <InfoItem label="Gender" value={selectedSkater.gender} />
              <InfoItem label="Category" value={CATEGORY_LABELS[selectedSkater.category] || selectedSkater.category} />
              <InfoItem label="Club" value={selectedSkater.club || '—'} />
              <InfoItem label="Races" value={selectedSkater.stats.total_races.toString()} />
              <InfoItem label="Finals" value={selectedSkater.stats.finals_appearances.toString()} />
              <InfoItem label="Threat" value={selectedSkater.stats.threat_score?.toFixed(1) || '—'} />
              <InfoItem 
                label="Medals" 
                value={`🥇${selectedSkater.stats.medals.gold} 🥈${selectedSkater.stats.medals.silver} 🥉${selectedSkater.stats.medals.bronze}`} 
              />
            </div>

            {/* Personal Bests - Inline */}
            <div className="mt-4 flex items-center gap-4">
              <h3 className="text-sm font-semibold text-gray-600">PB:</h3>
              {['500', '1000', '1500'].map((dist) => (
                <div key={dist} className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">{dist}m</span>
                  <span className="font-bold text-gray-900">
                    {selectedSkater.personal_bests?.[dist] || '—'}
                  </span>
                </div>
              ))}
            </div>

            {/* Detailed Stats - Compact inline */}
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span><span className="text-gray-500">Passes:</span> <span className="font-semibold">{selectedSkater.stats.total_passes_made}</span></span>
              <span><span className="text-gray-500">Passed:</span> <span className="font-semibold">{selectedSkater.stats.total_times_passed}</span></span>
              <span><span className="text-gray-500">Net:</span> <span className="font-semibold">{selectedSkater.stats.net_passes}</span></span>
              <span><span className="text-gray-500">Avg/Race:</span> <span className="font-semibold">{selectedSkater.stats.avg_passes_per_race?.toFixed(2) || '—'}</span></span>
              <span><span className="text-gray-500">Penalty:</span> <span className="font-semibold">{selectedSkater.stats.penalty_rate ? `${(selectedSkater.stats.penalty_rate * 100).toFixed(1)}%` : '—'}</span></span>
              <span><span className="text-gray-500">Clean:</span> <span className="font-semibold">{selectedSkater.stats.clean_race_pct ? `${(selectedSkater.stats.clean_race_pct * 100).toFixed(1)}%` : '—'}</span></span>
            </div>
          </div>

          {/* Event-by-Event Table - Compact */}
          {selectedSkater.events && selectedSkater.events.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">📋 Events</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-1 px-1 font-semibold text-gray-600">Event</th>
                      <th className="text-center py-1 px-1 font-semibold text-gray-600">Races</th>
                      <th className="text-center py-1 px-1 font-semibold text-gray-600">Rank</th>
                      <th className="text-center py-1 px-1 font-semibold text-gray-600">Final</th>
                      <th className="text-center py-1 px-1 font-semibold text-gray-600">Medal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSkater.events.map((ev, i) => (
                      <tr
                        key={ev.event_id + '-' + i}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                      >
                        <td className="py-1 px-1 text-gray-900">{cleanEventName(ev.name)}</td>
                        <td className="py-1 px-1 text-center text-gray-700">{ev.races}</td>
                        <td className="py-1 px-1 text-center text-gray-700">{ev.best_rank ?? '—'}</td>
                        <td className="py-1 px-1 text-center">{ev.finals_reached || ev.medal ? '✅' : '❌'}</td>
                        <td className="py-1 px-1 text-center">{medalEmoji(ev.medal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Time Trend Charts - Performance Trends */}
          {Object.keys(timeTrendData).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Performance Trends</h3>
              <div className="space-y-8">
                {[500, 1000, 1500].map((distance) => {
                  const data = timeTrendData[distance];
                  if (!data || data.length < 2) return null;
                  
                  const minTimeFromTrends = Math.min(...data.map(d => d.time));
                  const maxTime = Math.max(...data.map(d => d.time));
                  
                  // Use actual PB from skater profile if available and better
                  const pbFromProfile = selectedSkater?.personal_bests?.[String(distance)];
                  let actualPB = minTimeFromTrends;
                  if (pbFromProfile) {
                    const pbSeconds = pbFromProfile.includes(':') 
                      ? parseInt(pbFromProfile.split(':')[0]) * 60 + parseFloat(pbFromProfile.split(':')[1])
                      : parseFloat(pbFromProfile);
                    if (!isNaN(pbSeconds) && pbSeconds < minTimeFromTrends) {
                      actualPB = pbSeconds;
                    }
                  }
                  
                  const minTime = Math.min(actualPB, minTimeFromTrends);
                  const padding = (maxTime - minTime) * 0.1;
                  
                  const chartData = data.map(d => ({
                    ...d,
                    timestamp: d.date.getTime(),
                  }));
                  
                  const minDate = Math.min(...chartData.map(d => d.timestamp));
                  const maxDate = Math.max(...chartData.map(d => d.timestamp));
                  
                  return (
                    <div key={distance}>
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-md font-medium text-gray-700">
                          {distance}m Time Trend
                        </h4>
                        <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                          PB: {formatTime(actualPB)}
                        </span>
                      </div>
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart
                          data={chartData}
                          margin={{ top: 10, right: 80, left: 60, bottom: 40 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="timestamp"
                            type="number"
                            scale="time"
                            domain={[minDate, maxDate]}
                            tickFormatter={(ts) => {
                              const d = new Date(ts);
                              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                            }}
                            tick={{ fontSize: 11 }}
                          />
                          <YAxis
                            domain={[minTime - padding, maxTime + padding]}
                            reversed={true}
                            tickFormatter={(v) => formatTime(v)}
                            tick={{ fontSize: 11 }}
                          />
                          <Tooltip
                            formatter={(value: number | undefined) => [value ? formatTime(value) : '—', 'Time']}
                            labelFormatter={(_, payload) => {
                              if (payload && payload[0]) {
                                const d = payload[0].payload as { competition: string; dateStr: string };
                                return `${d.competition}\n${d.dateStr}`;
                              }
                              return '';
                            }}
                          />
                          <ReferenceLine 
                            y={actualPB} 
                            stroke="#D97706" 
                            strokeWidth={2}
                            strokeDasharray="5 5"
                          />
                          <Line
                            type="monotone"
                            dataKey="time"
                            stroke={DISTANCE_COLORS[distance]}
                            strokeWidth={2}
                            dot={{ fill: DISTANCE_COLORS[distance], r: 4 }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No time trend data message */}
          {Object.keys(timeTrendData).length === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800">
                ⚠️ No time trend data available for this skater. USS results or STL personal bests required.
              </p>
            </div>
          )}

          {/* Overtake Style + Distance Performance (2-column) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Overtake Style Breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">⚡ Overtake Timing Style</h3>
              {overtakeStyleData.every((d) => d.value === 0) ? (
                <p className="text-gray-400 text-sm text-center py-8">No overtake data available</p>
              ) : (
                <div style={{ height: 250 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={overtakeStyleData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent }) =>
                          `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                        }
                      >
                        {overtakeStyleData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number | undefined) => [value ?? 0, 'Passes']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Distance Performance */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Distance Performance</h3>
              {distanceData.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No distance data available</p>
              ) : (
                <div style={{ height: 250 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distanceData} margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="distance" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="races" name="Races" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!selectedSkater && (
        <div className="bg-gray-50 rounded-xl p-12 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-gray-700">Search for a Skater</h3>
          <p className="text-gray-500 mt-2">
            Enter a skater's name above to view their profile and performance trends
          </p>
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded p-2 text-center">
      <div className="text-[10px] text-gray-500 uppercase">{label}</div>
      <div className="text-sm font-semibold text-gray-900">{value}</div>
    </div>
  );
}

// StatRow removed - using inline stats now
