import { useState, useMemo } from 'react';
import type { Skater } from '../types/data';
import { STYLE_LABELS } from '../types/data';

interface Props {
  skaters: Skater[];
}

type SortKey =
  | 'name'
  | 'nationality'
  | 'ice_age'
  | 'dob'
  | 'club'
  | 'total_races'
  | 'total_passes_made'
  | 'total_times_passed'
  | 'net_passes'
  | 'avg_passes_per_race'
  | 'passes_early'
  | 'passes_middle'
  | 'passes_late'
  | 'style'
  | 'pb_500'
  | 'pb_1000'
  | 'pb_1500';

const STYLE_ORDER = ['front_runner', 'mid_surge', 'late_mover', 'balanced', 'no_passes', 'developing', 'sprint', 'unknown'];

function parseTimeToSeconds(t: string | undefined): number {
  if (!t) return 99999;
  const s = t.trim();
  if (s.includes(':')) {
    const [mins, secs] = s.split(':');
    return parseFloat(mins) * 60 + parseFloat(secs);
  }
  const v = parseFloat(s);
  return isNaN(v) ? 99999 : v;
}

const columns: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'nationality', label: 'NAT' },
  { key: 'ice_age', label: 'Ice Age' },
  { key: 'dob', label: 'DOB' },
  { key: 'club', label: 'Club' },
  { key: 'total_races', label: 'Races' },
  { key: 'total_passes_made', label: 'Passes' },
  { key: 'total_times_passed', label: 'Passed' },
  { key: 'net_passes', label: 'Net' },
  { key: 'avg_passes_per_race', label: 'Avg/Race' },
  { key: 'passes_early', label: 'Early' },
  { key: 'passes_middle', label: 'Mid' },
  { key: 'passes_late', label: 'Late' },
  { key: 'style', label: 'Style' },
  { key: 'pb_500', label: '500m PB' },
  { key: 'pb_1000', label: '1000m PB' },
  { key: 'pb_1500', label: '1500m PB' },
];

/**
 * Ice age = age before July 1 of the season start year.
 * For US youth skaters (shorttracklive.info), the stored `age` IS the ice age.
 * For ISU skaters with real DOBs, compute from DOB.
 */
function getIceAge(s: Skater): number | null {
  // US youth: stored age from shorttracklive is already ice age
  if (s.source === 'shorttracklive.info' || s.source === 'shorttrackonline.info') {
    return s.age ?? null;
  }
  // ISU / other: compute from DOB, cutoff July 1, 2025
  if (!s.dob) return s.age ?? null;
  const birth = new Date(s.dob);
  if (isNaN(birth.getTime())) return s.age ?? null;
  const cutoff = new Date(2025, 6, 1); // July 1, 2025
  let age = cutoff.getFullYear() - birth.getFullYear();
  if (
    cutoff.getMonth() < birth.getMonth() ||
    (cutoff.getMonth() === birth.getMonth() && cutoff.getDate() < birth.getDate())
  ) {
    age--;
  }
  return age;
}

function formatDOB(dob: string | null | undefined): string {
  if (!dob) return '—';
  const parts = dob.split('-');
  if (parts.length === 3) return `${parts[1]}/${parts[2]}/${parts[0]}`;
  return dob;
}

function getSortValue(s: Skater, key: SortKey): number | string {
  switch (key) {
    case 'name':
      return s.name.toLowerCase();
    case 'nationality':
      return s.nationality;
    case 'ice_age':
      return getIceAge(s) ?? 9999;
    case 'dob':
      return s.dob ?? 'zzz';
    case 'club':
      return (s.club ?? 'zzz').toLowerCase();
    case 'style':
      return STYLE_ORDER.indexOf(s.stats.style);
    case 'pb_500':
      return parseTimeToSeconds(s.personal_bests?.['500']);
    case 'pb_1000':
      return parseTimeToSeconds(s.personal_bests?.['1000']);
    case 'pb_1500':
      return parseTimeToSeconds(s.personal_bests?.['1500']);
    default:
      return s.stats[key] as number;
  }
}

const STYLE_COLORS: Record<string, string> = {
  late_mover: 'bg-red-50 text-red-800 border-red-200',
  front_runner: 'bg-green-50 text-green-800 border-green-200',
  mid_surge: 'bg-amber-50 text-amber-800 border-amber-200',
  balanced: 'bg-blue-50 text-blue-800 border-blue-200',
  no_passes: 'bg-gray-100 text-gray-600 border-gray-200',
  developing: 'bg-purple-50 text-purple-800 border-purple-200',
  sprint: 'bg-cyan-50 text-cyan-800 border-cyan-200',
  unknown: 'bg-gray-100 text-gray-500 border-gray-200',
};

export default function SkaterTable({ skaters }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('pb_500');
  const [sortAsc, setSortAsc] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return skaters;
    const q = searchQuery.toLowerCase();
    return skaters.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.nationality.toLowerCase().includes(q) ||
        (s.club?.toLowerCase().includes(q) ?? false)
    );
  }, [skaters, searchQuery]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = getSortValue(a, sortKey);
      const vb = getSortValue(b, sortKey);
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      const ascByDefault = ['name', 'nationality', 'club', 'dob', 'pb_500', 'pb_1000', 'pb_1500'].includes(key);
      setSortAsc(ascByDefault);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-lg font-bold text-gray-900">
          All Skaters ({sorted.length}{filtered.length !== skaters.length ? ` of ${skaters.length}` : ''})
        </h2>
        <input
          type="text"
          placeholder="Search name, country, or club..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2646A7] focus:border-transparent w-full sm:w-64"
        />
      </div>
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b border-gray-200">
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase bg-white">#</th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-[#2646A7] select-none whitespace-nowrap bg-white"
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="ml-1">{sortAsc ? '▲' : '▼'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => (
              <tr
                key={s.id}
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <td className="px-2 py-2 text-gray-400 text-xs">{i + 1}</td>
                <td className="px-2 py-2 font-semibold text-gray-900 whitespace-nowrap">
                  {s.flag} {s.name}
                </td>
                <td className="px-2 py-2 text-gray-600">{s.nationality}</td>
                <td className="px-2 py-2 text-gray-700 font-semibold">{getIceAge(s) ?? '—'}</td>
                <td className="px-2 py-2 text-gray-600 text-xs whitespace-nowrap">{formatDOB(s.dob)}</td>
                <td className="px-2 py-2 text-gray-600 whitespace-nowrap">{s.club ?? '—'}</td>
                <td className="px-2 py-2 text-gray-900">{s.stats.total_races}</td>
                <td className="px-2 py-2 font-semibold text-[#2646A7]">
                  {s.stats.total_passes_made}
                </td>
                <td className="px-2 py-2 text-red-600">{s.stats.total_times_passed}</td>
                <td className={`px-2 py-2 font-semibold ${s.stats.net_passes >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {s.stats.net_passes > 0 ? '+' : ''}
                  {s.stats.net_passes}
                </td>
                <td className="px-2 py-2 text-gray-700">
                  {s.stats?.avg_passes_per_race?.toFixed(1) ?? '0.0'}
                </td>
                <td className="px-2 py-2 text-gray-600">{s.stats?.passes_early ?? 0}</td>
                <td className="px-2 py-2 text-gray-600">{s.stats?.passes_middle ?? 0}</td>
                <td className="px-2 py-2 text-gray-600">{s.stats?.passes_late ?? 0}</td>
                <td className="px-2 py-2">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STYLE_COLORS[s.stats?.style || 'unknown']}`}
                  >
                    {STYLE_LABELS[s.stats?.style || 'unknown']}
                  </span>
                </td>
                <td className="px-2 py-2 text-gray-700 font-mono text-xs whitespace-nowrap">
                  {s.personal_bests?.['500'] ?? '—'}
                </td>
                <td className="px-2 py-2 text-gray-700 font-mono text-xs whitespace-nowrap">
                  {s.personal_bests?.['1000'] ?? '—'}
                </td>
                <td className="px-2 py-2 text-gray-700 font-mono text-xs whitespace-nowrap">
                  {s.personal_bests?.['1500'] ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
