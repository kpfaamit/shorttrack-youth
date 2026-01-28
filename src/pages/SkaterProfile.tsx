import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import type { Skater } from '../types/data';
import { STYLE_LABELS } from '../types/data';

interface Props {
  skaters: Skater[];
  profiles: Record<string, SkaterProfile> | null;
}

interface SkaterProfile {
  skater_id: number;
  name: string;
  country: string;
  gender: string;
  age: number;
  age_category: string;
  home_town: string | null;
  club: string | null;
  personal_bests: PersonalBest[];
  distance_classifications?: DistanceClassification[];
  overall_classification?: OverallClassification[];
}

interface PersonalBest {
  distance: number;
  class: string;
  time: string;
  competition: string;
  date: string;
}

interface DistanceClassification {
  distance: number;
  class: string;
  rank: string;
}

interface OverallClassification {
  class: string;
  rank: string;
}

function parseTimeToSeconds(t: string): number {
  const s = t.trim();
  if (s.includes(':')) {
    const [mins, secs] = s.split(':');
    return parseFloat(mins) * 60 + parseFloat(secs);
  }
  return parseFloat(s);
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  if (mins > 0) {
    return `${mins}:${secs.padStart(6, '0')}`;
  }
  return secs;
}

function parseDate(dateStr: string): Date {
  // Format: "17.12. - 19.12.2021" or "10.09. - 11.09.2024"
  // Take the first date
  const parts = dateStr.split(' - ')[0].trim();
  const [day, month, year] = parts.split('.');
  const yearPart = year || dateStr.split('.').pop()?.match(/\d{4}/)?.[0] || '2024';
  return new Date(parseInt(yearPart), parseInt(month) - 1, parseInt(day));
}

const DISTANCE_COLORS: Record<number, string> = {
  500: '#2646A7',
  1000: '#059669',
  1500: '#D97706',
};

export default function SkaterProfile({ skaters, profiles }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSkater, setSelectedSkater] = useState<Skater | null>(null);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return skaters
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, 10);
  }, [skaters, searchQuery]);

  // Get profile data for selected skater
  const skaterProfile = useMemo(() => {
    if (!selectedSkater || !profiles) return null;
    // Try to find by name match
    const normalizedName = selectedSkater.name.toUpperCase().replace(/\s+/g, ' ');
    for (const [, profile] of Object.entries(profiles)) {
      const profileName = profile.name.toUpperCase().replace(/\s+/g, ' ');
      if (profileName.includes(normalizedName) || normalizedName.includes(profileName.split(' ').slice(-1)[0])) {
        return profile;
      }
    }
    return null;
  }, [selectedSkater, profiles]);

  // Prepare time trend data for each distance
  const timeTrendData = useMemo(() => {
    if (!skaterProfile?.personal_bests) return {};
    
    const byDistance: Record<number, { date: Date; time: number; competition: string; dateStr: string }[]> = {};
    
    for (const pb of skaterProfile.personal_bests) {
      if (!byDistance[pb.distance]) {
        byDistance[pb.distance] = [];
      }
      try {
        const date = parseDate(pb.date);
        const time = parseTimeToSeconds(pb.time);
        if (!isNaN(time) && !isNaN(date.getTime())) {
          byDistance[pb.distance].push({
            date,
            time,
            competition: pb.competition,
            dateStr: pb.date,
          });
        }
      } catch (e) {
        // Skip invalid data
      }
    }
    
    // Sort by date
    for (const dist of Object.keys(byDistance)) {
      byDistance[parseInt(dist)].sort((a, b) => a.date.getTime() - b.date.getTime());
    }
    
    return byDistance;
  }, [skaterProfile]);

  const handleSelectSkater = (skater: Skater) => {
    setSelectedSkater(skater);
    setSearchQuery('');
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
                    {skater.nationality} • {skater.category === 'senior' ? 'Senior' : skater.category === 'junior' ? 'Junior' : skater.category}
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
            </div>

            {/* Info Table */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <InfoItem label="Age" value={selectedSkater.age?.toString() || '—'} />
              <InfoItem label="Gender" value={selectedSkater.gender} />
              <InfoItem label="Category" value={selectedSkater.category === 'senior' ? 'Senior' : selectedSkater.category === 'junior' ? 'Junior' : selectedSkater.category} />
              <InfoItem label="Club" value={selectedSkater.club || '—'} />
              <InfoItem label="Total Races" value={selectedSkater.stats.total_races.toString()} />
              <InfoItem label="Finals" value={selectedSkater.stats.finals_appearances.toString()} />
              <InfoItem label="Threat Score" value={selectedSkater.stats.threat_score?.toFixed(1) || '—'} />
              <InfoItem 
                label="Medals" 
                value={`🥇${selectedSkater.stats.medals.gold} 🥈${selectedSkater.stats.medals.silver} 🥉${selectedSkater.stats.medals.bronze}`} 
              />
            </div>

            {/* Personal Bests */}
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Personal Bests</h3>
              <div className="grid grid-cols-3 gap-4">
                {['500', '1000', '1500'].map((dist) => (
                  <div key={dist} className="bg-gray-50 rounded-lg p-4 text-center">
                    <div className="text-sm text-gray-500 mb-1">{dist}m</div>
                    <div className="text-xl font-bold text-gray-900">
                      {selectedSkater.personal_bests?.[dist] || '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats Table */}
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Detailed Stats</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    <StatRow label="Total Passes Made" value={selectedSkater.stats.total_passes_made} />
                    <StatRow label="Times Passed" value={selectedSkater.stats.total_times_passed} />
                    <StatRow label="Net Passes" value={selectedSkater.stats.net_passes} />
                    <StatRow label="Avg Passes/Race" value={selectedSkater.stats.avg_passes_per_race?.toFixed(2)} />
                    <StatRow label="Penalty Rate" value={selectedSkater.stats.penalty_rate ? `${(selectedSkater.stats.penalty_rate * 100).toFixed(1)}%` : '—'} />
                    <StatRow label="Clean Race %" value={selectedSkater.stats.clean_race_pct ? `${(selectedSkater.stats.clean_race_pct * 100).toFixed(1)}%` : '—'} />
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Time Trend Charts */}
          {Object.keys(timeTrendData).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Performance Trends</h3>
              <div className="space-y-8">
                {[500, 1000, 1500].map((distance) => {
                  const data = timeTrendData[distance];
                  if (!data || data.length < 2) return null;
                  
                  const minTime = Math.min(...data.map(d => d.time));
                  const maxTime = Math.max(...data.map(d => d.time));
                  const padding = (maxTime - minTime) * 0.1;
                  
                  return (
                    <div key={distance}>
                      <h4 className="text-md font-medium text-gray-700 mb-2">
                        {distance}m Time Trend
                      </h4>
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart
                          data={data.map((d, i) => ({
                            ...d,
                            index: i,
                            label: d.competition.length > 20 ? d.competition.substring(0, 20) + '...' : d.competition,
                          }))}
                          margin={{ top: 10, right: 30, left: 60, bottom: 60 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="label"
                            angle={-45}
                            textAnchor="end"
                            height={80}
                            tick={{ fontSize: 10 }}
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
                            y={minTime} 
                            stroke="#059669" 
                            strokeDasharray="5 5"
                            label={{ value: `PB: ${formatTime(minTime)}`, position: 'right', fontSize: 10, fill: '#059669' }}
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
              {Object.keys(timeTrendData).length === 0 && (
                <p className="text-gray-500 text-center py-8">
                  No historical time data available for this skater.
                </p>
              )}
            </div>
          )}

          {/* No profile data message */}
          {!skaterProfile && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800">
                ⚠️ No detailed profile data available for this skater. Time trends require historical race data.
              </p>
            </div>
          )}
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
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-lg font-semibold text-gray-900 mt-1">{value}</div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <tr className="border-b border-gray-100">
      <td className="py-2 text-gray-600">{label}</td>
      <td className="py-2 text-right font-medium text-gray-900">{value ?? '—'}</td>
    </tr>
  );
}
