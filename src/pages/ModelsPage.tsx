import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import type { Models } from '../types/data';
import MethodologyCard from '../components/cards/MethodologyCard';

interface Props {
  models: Models | null;
}

const CHART_COLORS = {
  blue: '#2646A7',
  cyan: '#0891B2',
  purple: '#7C3AED',
  gold: '#D97706',
  green: '#059669',
  red: '#DC2626',
  pink: '#DB2777',
  orange: '#EA580C',
  slate: '#64748B',
};

function KPI({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 text-center hover:border-[#2646A7] hover:-translate-y-0.5 transition-all cursor-default">
      <div className="text-[2rem] font-extrabold text-[#2646A7] leading-tight">
        {value}
      </div>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-1">
        {label}
      </div>
    </div>
  );
}

// Feature descriptions for explanations
const OVERTAKE_FEATURE_DESCRIPTIONS: Record<string, string> = {
  rank_before: 'Starting behind = more room to overtake',
  height: 'Taller = longer stride advantage',
  lap_fraction: 'Later in race = harder to overtake',
  age: 'Older = slower reflexes',
  dist_1500: '1500m endurance advantage',
  round_stage: 'Later rounds = stronger opponents',
  dist_500: '500m sprint speed advantage',
  gender: 'Gender difference',
  dist_1000: '1000m middle-distance advantage',
  is_last_lap: 'Last lap = final push opportunity',
};

const MEDAL_FEATURE_DESCRIPTIONS: Record<string, string> = {
  net_passes: 'Net passes = overtaking ability',
  avg_passes_per_race: 'Passes per race = aggressiveness',
  passes_made: 'Total passes = experience',
  starting_position: 'Front start = better advantage',
  times_passed: 'Fewer times passed = good defense',
  distance: 'Distance adaptability',
  style: 'Racing style fit',
  height: 'Height advantage',
  age: 'Age/experience factor',
  gender: 'Gender category',
  total_races: 'Race count = experience level',
  avg_position: 'Avg finish = consistency',
  finals_rate: 'Finals rate = competitiveness',
  threat_score: 'Threat score = overall strength',
  clean_race_pct: 'Clean race % = fewer penalties',
  penalty_rate: 'High penalty rate = negative impact',
};

function FeatureExplanationTable({ 
  data, 
  descriptions 
}: { 
  data: { feature: string; effect: string; importance: number }[];
  descriptions: Record<string, string>;
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 font-semibold text-gray-700">Feature</th>
            <th className="text-center py-2 px-1 font-semibold text-gray-700 w-16">Effect</th>
            <th className="text-left py-2 px-3 font-semibold text-gray-700">Description</th>
            <th className="text-right py-2 px-3 font-semibold text-gray-700 w-24">Importance</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, idx) => (
            <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-50' : ''}>
              <td className="py-2 px-3 font-mono text-xs">{item.feature}</td>
              <td className="py-2 px-1 text-center">
                {item.effect === 'positive' ? (
                  <span className="text-green-600 font-bold">🟢+</span>
                ) : item.effect === 'negative' ? (
                  <span className="text-red-600 font-bold">🔴−</span>
                ) : (
                  <span className="text-gray-400">○</span>
                )}
              </td>
              <td className="py-2 px-3 text-gray-600">
                {descriptions[item.feature] ?? '—'}
              </td>
              <td className="py-2 px-3 text-right font-mono text-xs text-gray-500">
                {(item.importance * 100).toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HorizontalBarSection({
  title,
  data,
  dataKey,
  nameKey,
  fill,
  height,
  leftMargin,
  formatter,
  showEffectColors,
  featureDescriptions,
}: {
  title: string;
  data: Record<string, unknown>[];
  dataKey: string;
  nameKey: string;
  fill: string;
  height?: number;
  leftMargin?: number;
  formatter?: (v: number) => string;
  showEffectColors?: boolean;
  featureDescriptions?: Record<string, string>;
}) {
  // For feature importance with effects, use signedImportance
  const chartDataKey = showEffectColors ? 'signedImportance' : dataKey;
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">{title}</h3>
      {showEffectColors && (
        <div className="flex gap-4 mb-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-[#059669]"></span> Positive effect
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-[#DC2626]"></span> Negative effect
          </span>
        </div>
      )}
      <ResponsiveContainer
        width="100%"
        height={height ?? Math.max(300, data.length * 32)}
        minWidth={0}
      >
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: leftMargin ?? 120, right: 20, top: 5, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 12 }}
            tickFormatter={formatter}
            domain={showEffectColors ? ['dataMin', 'dataMax'] : undefined}
          />
          <YAxis
            type="category"
            dataKey={nameKey}
            tick={{ fontSize: 11 }}
            width={(leftMargin ?? 120) - 10}
          />
          <Tooltip
            formatter={(value: number | undefined) => {
              const absValue = value != null ? Math.abs(value) : 0;
              const formatted = formatter ? formatter(absValue) : absValue.toFixed(4);
              return [formatted, 'Importance'];
            }}
          />
          {showEffectColors ? (
            <Bar dataKey={chartDataKey} radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`}
                  fill={entry.effect === 'negative' ? '#DC2626' : '#059669'}
                />
              ))}
            </Bar>
          ) : (
            <Bar dataKey={dataKey} fill={fill} radius={[0, 4, 4, 0]} />
          )}
        </BarChart>
      </ResponsiveContainer>
      {showEffectColors && featureDescriptions && (
        <FeatureExplanationTable 
          data={data as { feature: string; effect: string; importance: number }[]}
          descriptions={featureDescriptions}
        />
      )}
    </div>
  );
}

function VerticalBarSection({
  title,
  data,
  dataKey,
  nameKey,
  fill,
  height,
  formatter,
}: {
  title: string;
  data: Record<string, unknown>[];
  dataKey: string;
  nameKey: string;
  fill: string;
  height?: number;
  formatter?: (v: number) => string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">{title}</h3>
      <ResponsiveContainer
        width="100%"
        height={height ?? 320}
        minWidth={0}
      >
        <BarChart data={data} margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={nameKey} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={formatter} />
          <Tooltip
            formatter={(value: number | undefined) => [
              value != null && formatter ? formatter(value) : (value ?? 0),
              dataKey,
            ]}
          />
          <Bar dataKey={dataKey} fill={fill} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ModelsPage({ models }: Props) {
  // ── Overtake Model data ──
  // Feature effect direction: positive = helps overtake, negative = hinders
  const FEATURE_EFFECTS: Record<string, 'positive' | 'negative' | 'neutral'> = {
    rank_before: 'positive',       // Starting behind = more room to overtake
    height: 'positive',            // Taller = longer stride
    lap_fraction: 'negative',      // Later in race = harder to overtake
    age: 'negative',               // Older = slower reflexes
    dist_1500: 'positive',         // Endurance helps
    round_stage: 'negative',       // Later rounds = harder competition
    dist_500: 'positive',          // Sprint speed helps
    gender: 'neutral',             // No inherent direction
    dist_1000: 'positive',         // Middle distance helps
    is_last_lap: 'positive',       // Last lap = final push opportunity
  };

  const overtakeFeatureData = useMemo(() => {
    if (!models) return [];
    return [...models.overtake_model.feature_importance_ranked]
      .sort((a, b) => b.importance - a.importance)  // Descending: most important first (top)
      .slice(0, 10)
      .map(f => ({
        ...f,
        effect: FEATURE_EFFECTS[f.feature] ?? 'neutral',
        // Make importance signed based on effect direction
        signedImportance: FEATURE_EFFECTS[f.feature] === 'negative' ? -f.importance : f.importance,
      }));
  }, [models]);

  const overtakeByPosition = useMemo(() => {
    if (!models) return [];
    const data = (models.overtake_model as unknown as Record<string, unknown>)['overtake_probability_by_position'] as Record<string, number> | undefined
      ?? models.overtake_model.overtake_by_position;
    if (!data) return [];
    return Object.entries(data)
      .map(([pos, rate]) => {
        // Keys can be "from_pos_1" or just "1"
        const num = pos.replace(/\D+/g, '').replace(/^0+/, '') || pos;
        return { position: `P${num}`, rate: rate as number };
      })
      .sort((a, b) => {
        const na = parseInt(a.position.slice(1));
        const nb = parseInt(b.position.slice(1));
        return na - nb;
      });
  }, [models]);

  const ageEffectData = useMemo(() => {
    if (!models?.overtake_model?.age_effect) return [];
    return Object.entries(models.overtake_model.age_effect).map(
      ([range, rate]) => ({ range, rate: rate as number })
    );
  }, [models]);

  // ── Medal Model data ──
  // Feature effect direction for medal model
  const MEDAL_FEATURE_EFFECTS: Record<string, 'positive' | 'negative' | 'neutral'> = {
    total_races: 'positive',       // More experience = better
    avg_position: 'negative',      // Higher avg position = worse (lower is better)
    finals_rate: 'positive',       // More finals = better
    threat_score: 'positive',      // Higher threat = more likely to medal
    clean_race_pct: 'positive',    // Cleaner races = better
    passes_made: 'positive',       // More passes = aggressive/capable
    penalty_rate: 'negative',      // More penalties = worse
    net_passes: 'positive',        // Net positive passes = better
  };

  const medalFeatureData = useMemo(() => {
    if (!models) return [];
    return [...models.medal_model.feature_importance]
      .sort((a, b) => b.importance - a.importance)  // Descending: most important first (top)
      .slice(0, 10)
      .map(f => ({
        ...f,
        effect: MEDAL_FEATURE_EFFECTS[f.feature] ?? 'neutral',
        signedImportance: MEDAL_FEATURE_EFFECTS[f.feature] === 'negative' ? -f.importance : f.importance,
      }));
  }, [models]);

  const medalByPosition = useMemo(() => {
    if (!models?.medal_model?.medal_by_position) return [];
    return Object.entries(models.medal_model.medal_by_position)
      .map(([pos, data]) => {
        const num = pos.replace(/\D+/g, '').replace(/^0+/, '') || pos;
        return {
          position: `P${num}`,
          probability: data.probability,
        };
      })
      .sort((a, b) => {
        const na = parseInt(a.position.slice(1));
        const nb = parseInt(b.position.slice(1));
        return na - nb;
      });
  }, [models]);

  const medalByNationality = useMemo(() => {
    if (!models?.medal_model?.medal_by_nationality) return [];
    return Object.entries(models.medal_model.medal_by_nationality)
      .sort((a, b) => b[1].medals - a[1].medals)  // Most medals first (top)
      .slice(0, 10)
      .map(([nation, data]) => ({
        nationality: nation,
        medals: data.medals,
      }));
  }, [models]);

  const medalByStyle = useMemo(() => {
    if (!models?.medal_model?.medal_by_style) return [];
    return Object.entries(models.medal_model.medal_by_style).map(
      ([styleName, data]) => ({
        styleName,
        probability: data.probability,
      })
    );
  }, [models]);

  const pctFmt = (v: number) => `${(v * 100).toFixed(0)}%`;

  if (!models) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">
            🤖 Prediction Models
          </h1>
          <p className="text-gray-500 mt-1">
            Machine learning models that predict overtakes and medals.
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-3">🤖</div>
          <p className="text-gray-500 text-sm">Models not available</p>
          <p className="text-gray-400 text-xs mt-1">
            Model data could not be loaded.
          </p>
        </div>
      </div>
    );
  }

  const om = models.overtake_model;
  const mm = models.medal_model;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">
          🤖 Prediction Models
        </h1>
        <p className="text-gray-500 mt-1">
          Machine learning models that predict overtakes and medals — backed by
          thousands of races.
        </p>
      </div>

      {/* ═══════════════ Overtake Model ═══════════════ */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#2646A7] text-white text-sm font-bold">
            ⚡
          </span>
          Overtake Prediction Model
        </h2>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <KPI
            value={`${(om.accuracy * 100).toFixed(1)}%`}
            label="Accuracy"
          />
          <KPI value={om.n_samples.toLocaleString()} label="Training Samples" />
          <KPI
            value={`${(om.overtake_rate * 100).toFixed(1)}%`}
            label="Overtake Rate"
          />
        </div>

        {/* Feature Importance */}
        <HorizontalBarSection
          title="Feature Importance (Top 10)"
          data={overtakeFeatureData as unknown as Record<string, unknown>[]}
          dataKey="importance"
          nameKey="feature"
          fill={CHART_COLORS.blue}
          leftMargin={160}
          showEffectColors={true}
          featureDescriptions={OVERTAKE_FEATURE_DESCRIPTIONS}
        />

        {/* Overtake by Position */}
        <VerticalBarSection
          title="Overtake Rate by Starting Position"
          data={overtakeByPosition as unknown as Record<string, unknown>[]}
          dataKey="rate"
          nameKey="position"
          fill={CHART_COLORS.cyan}
          formatter={pctFmt}
        />

        {/* Age Effect */}
        <VerticalBarSection
          title="Overtake Rate by Age"
          data={ageEffectData as unknown as Record<string, unknown>[]}
          dataKey="rate"
          nameKey="range"
          fill={CHART_COLORS.gold}
          formatter={pctFmt}
        />
      </div>

      {/* ═══════════════ Medal Model ═══════════════ */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#D97706] text-white text-sm font-bold">
            🏅
          </span>
          Medal Prediction Model
        </h2>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <KPI
            value={`${(mm.accuracy * 100).toFixed(1)}%`}
            label="Accuracy"
          />
          <KPI value={mm.n_samples.toLocaleString()} label="Training Samples" />
          <KPI
            value={`${(mm.medal_rate * 100).toFixed(1)}%`}
            label="Medal Rate"
          />
        </div>

        {/* Feature Importance */}
        <HorizontalBarSection
          title="Feature Importance (Top 10)"
          data={medalFeatureData as unknown as Record<string, unknown>[]}
          dataKey="importance"
          nameKey="feature"
          fill={CHART_COLORS.gold}
          leftMargin={160}
          showEffectColors={true}
          featureDescriptions={MEDAL_FEATURE_DESCRIPTIONS}
        />

        {/* Medal by Position */}
        <VerticalBarSection
          title="Medal Probability by Starting Position"
          data={medalByPosition as unknown as Record<string, unknown>[]}
          dataKey="probability"
          nameKey="position"
          fill={CHART_COLORS.green}
          formatter={pctFmt}
        />

        {/* Medal by Nationality + Style (2 col) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <HorizontalBarSection
            title="Medal Count by Nationality (Top 10)"
            data={medalByNationality as unknown as Record<string, unknown>[]}
            dataKey="medals"
            nameKey="nationality"
            fill={CHART_COLORS.orange}
            leftMargin={80}
          />
          <VerticalBarSection
            title="Medal Probability by Style"
            data={medalByStyle as unknown as Record<string, unknown>[]}
            dataKey="probability"
            nameKey="styleName"
            fill={CHART_COLORS.pink}
            formatter={pctFmt}
          />
        </div>
      </div>

      {/* Methodology */}
      <MethodologyCard
        title="Prediction Models — Methodology & Metrics"
        intro="Two GradientBoosting classifiers trained on ISU World Tour 2025-2026 race data. Models use scikit-learn with train/test split validation. Feature importance is computed via mean decrease in impurity."
        metrics={[
          { term: 'Accuracy', definition: 'Classification accuracy on the held-out test set (proportion of correct predictions).' },
          { term: 'Training Samples', definition: 'Number of labeled examples used to train the model (individual heat-skater rows).' },
          { term: 'Overtake Rate', definition: 'Base rate — proportion of lap transitions that resulted in an overtake. The model must beat this baseline.' },
          { term: 'Medal Rate', definition: 'Base rate — proportion of Final A appearances that resulted in a podium finish.' },
          { term: 'Feature Importance', definition: 'Relative contribution of each input feature to the model\'s predictions. Higher = more influential. Computed via GradientBoosting\'s feature_importances_ (mean impurity decrease).' },
          { term: 'Overtake by Position', definition: 'Probability of making at least one overtake given a starting position (P1, P2, etc.). Lower positions have higher overtake probability.' },
          { term: 'Overtake by Age', definition: 'Overtake rate segmented by age group, showing how age correlates with passing frequency.' },
          { term: 'Medal by Position', definition: 'Probability of winning a medal given a starting lane/position in the final.' },
          { term: 'Medal by Nationality', definition: 'Total medal count by country — reflects depth of national programs, not individual skill.' },
          { term: 'Medal by Style', definition: 'Medal probability for each overtaking style (Late Mover, Front Runner, etc.). Shows which tactical approaches yield more podiums.' },
        ]}
      />
    </div>
  );
}
