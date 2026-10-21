import { useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useDash } from '../state';
import {
  axisProps, CHART, DataTable, InsightPanel, NumberField, PageHeader, Section, Select, ThresholdControl, METRIC_OPTIONS,
  type Insight,
} from '../components/ui';
import {
  cohortTable, compare, fmtH, fmtN, fmtPct, groupStats, METRIC_LABEL, monthlyTrend, orgAvg, thresholdText, type CohortBy, type GroupStat,
} from '../lib/metrics';
import { idleGapInsight, trendInsight, underTeamsInsight } from '../lib/insights';
import type { MetricKey } from '../types';

type RankKey = MetricKey | 'prodPct';
const COHORT_COLORS = [CHART.navy, CHART.orange, CHART.green, CHART.navySoft, CHART.red, CHART.yellow, '#6B4FA0', '#2A8FB8'];

export function TeamsPage() {
  const { ds, scope, stats, reliable, under, setUnder } = useDash();
  const cfg = ds.config;
  const [rankBy, setRankBy] = useState<RankKey>('active');
  const [leaders, setLeaders] = useState(cfg.defaults.leaderCount);
  const [cohortBy, setCohortBy] = useState<CohortBy>('band');
  const [cohortMetric, setCohortMetric] = useState<MetricKey>('active');
  const [bands, setBands] = useState(cfg.defaults.bands);

  const depts = useMemo(() => groupStats(stats, 'department', under, cfg.minGroupSize), [stats, under, cfg]);
  const teams = useMemo(() => groupStats(stats, 'team', under, cfg.minGroupSize), [stats, under, cfg]);
  const trend = useMemo(() => monthlyTrend(scope, stats), [scope, stats]);
  const org = useMemo(() => orgAvg(stats), [stats]);
  const powerCut = useMemo(() => {
    const ai = [...stats].map((s) => s.aiHrs).sort((a, b) => b - a);
    return ai[Math.min(ai.length - 1, cfg.defaults.aiPowerUserCount - 1)] ?? 1;
  }, [stats, cfg]);
  const cohort = useMemo(() => cohortTable(scope, reliable, cohortBy, cohortMetric, bands, powerCut), [scope, reliable, cohortBy, cohortMetric, bands, powerCut]);

  const patterns = [...depts].sort((a, b) => a.avg[under.metric] - b.avg[under.metric])
    .map((g) => ({ name: g.name, value: +g.avg[under.metric].toFixed(2), meeting: g.meeting }));
  const comp = [...depts].sort((a, b) => b.prodPct - a.prodPct)
    .map((g) => ({ name: g.name, Productive: +g.prodPct.toFixed(1), Neutral: +g.neutralPct.toFixed(1), Unproductive: +g.unprodPct.toFixed(1) }));
  const rankVal = (g: GroupStat) => (rankBy === 'prodPct' ? g.prodPct : g.avg[rankBy]);
  const ranked = [...teams].sort((a, b) => rankVal(b) - rankVal(a)).map((g, i) => ({ ...g, rank: i + 1 }));
  const n = Math.min(leaders, Math.floor(ranked.length / 2));
  const underPct = reliable.length ? (reliable.filter((s) => compare(s.avg[under.metric], under.op, under.value)).length / reliable.length) * 100 : 0;
  const worstComp = [...depts].sort((a, b) => b.unprodPct - a.unprodPct)[0];

  const insights = [
    idleGapInsight(org.online, org.active),
    trendInsight(trend),
    underTeamsInsight(depts, under, underPct),
    worstComp && worstComp.unprodPct > 5 ? {
      tone: 'priority', title: `Check ${worstComp.name}'s unproductive share`,
      body: `${fmtPct(worstComp.unprodPct, 1)} of its active time is tagged unproductive, the highest of any department. Look at which apps drive it - it is often a work tool tagged wrongly.`,
      link: { page: 'apps', anchor: 'urls' },
    } as Insight : null,
  ].filter(Boolean) as Insight[];

  const rankLabel = rankBy === 'prodPct' ? 'Productive %' : `Avg ${METRIC_LABEL[rankBy].toLowerCase()} hrs`;

  return (
    <>
      <PageHeader title="Teams & cohorts" lede="How departments and teams compare, how the month-by-month picture moves, and how groups of people behave over time." />
      <InsightPanel items={insights} />

      <div className="grid">
        <Section id="patterns" title="Department-wise productivity patterns"
          tools={<ThresholdControl value={under} onChange={setUnder} prefix="Count people averaging" />}
          note={`Bars: average ${METRIC_LABEL[under.metric].toLowerCase()} hours per present day. Line: people whose average is ${thresholdText(under)}. ${depts.length} departments with ${cfg.minGroupSize}+ people.`}>
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={patterns} margin={{ top: 10, right: 10, bottom: 70, left: 40 }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="name" {...axisProps} angle={-35} textAnchor="end" interval={0} height={80} />
              <YAxis yAxisId="h" {...axisProps} unit="h" />
              <YAxis yAxisId="c" orientation="right" {...axisProps} allowDecimals={false} />
              <Tooltip />
              <Legend verticalAlign="top" height={28} />
              <Bar yAxisId="h" dataKey="value" name={`Avg. ${METRIC_LABEL[under.metric].toLowerCase()} hrs/day`} fill={CHART.navy} radius={[3, 3, 0, 0]} />
              <Line yAxisId="c" dataKey="meeting" name={`People ${thresholdText(under)}`} stroke={CHART.orange} strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Section>

        <Section id="monthly" span={7} title={`${trend[0]?.weekly ? 'Week' : 'Month'}-wise online, active & productive time`}
          note={trend[0]?.weekly ? 'Average hours per present day, by week (short periods switch to weekly).' : 'Average hours per present day. * marks a month only partly inside the selected period.'}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={trend} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...axisProps} unit="h" />
              <Tooltip />
              <Legend verticalAlign="top" height={28} />
              <Bar dataKey="online" name="Online" fill={CHART.navy} radius={[3, 3, 0, 0]} />
              <Bar dataKey="active" name="Active" fill={CHART.orange} radius={[3, 3, 0, 0]} />
              <Bar dataKey="productive" name="Productive" fill={CHART.green} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Section>

        <Section id="composition" span={5} title="Activity & productivity composition"
          note="Share of each department's active time by the client's productivity tagging, normalised to 100%.">
          <ResponsiveContainer width="100%" height={Math.max(300, comp.length * 26 + 40)}>
            <BarChart data={comp} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 0 }} barCategoryGap={3}>
              <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} allowDataOverflow {...axisProps} unit="%" />
              <YAxis type="category" dataKey="name" {...axisProps} width={160} interval={0} tick={{ fill: CHART.axis, fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Legend verticalAlign="top" height={28} />
              <Bar dataKey="Productive" stackId="a" fill={CHART.green} />
              <Bar dataKey="Neutral" stackId="a" fill={CHART.grey} />
              <Bar dataKey="Unproductive" stackId="a" fill={CHART.red} />
            </BarChart>
          </ResponsiveContainer>
        </Section>

        <Section id="ranking" title="Which teams are leading vs. lagging"
          tools={<>
            <Select label="Rank by" value={rankBy} onChange={setRankBy}
              options={[...METRIC_OPTIONS.map((o) => ({ value: o.value as RankKey, label: `Rank by ${o.label.toLowerCase()}` })), { value: 'prodPct', label: 'Rank by productive %' }]} />
            <span className="ctl-label">Highlight top / bottom</span>
            <NumberField label="Highlight count" value={leaders} step={1} min={1} onChange={(v) => setLeaders(Math.max(1, Math.round(v)))} />
          </>}
          note="An activity signal from computer use, not a performance rating.">
          <div className="legend-inline"><span className="chip good">Top {n}</span><span className="chip bad">Bottom {n}</span></div>
          <DataTable rows={ranked} rowClass={(_, i) => (i < n ? 'row-good' : i >= ranked.length - n ? 'row-bad' : '')}
            cols={[
              { key: 'rank', label: '#', get: (r) => r.rank },
              { key: 'name', label: 'Team', get: (r) => r.name },
              { key: 'people', label: 'People', align: 'right', get: (r) => r.people },
              { key: 'val', label: rankLabel, align: 'right', get: rankVal, render: (r) => (rankBy === 'prodPct' ? fmtPct(r.prodPct, 1) : fmtH(r.avg[rankBy], 2)) },
              { key: 'prod', label: 'Productive %', align: 'right', get: (r) => r.prodPct, render: (r) => fmtPct(r.prodPct, 1) },
              { key: 'meet', label: `% ${thresholdText(under)}`, align: 'right', get: (r) => r.meetingPct, render: (r) => fmtPct(r.meetingPct) },
            ]} />
        </Section>

        <Section id="cohorts" title="Cohort explorer"
          tools={<>
            <Select label="Group people by" value={cohortBy} onChange={setCohortBy} options={[
              { value: 'band', label: 'Group by activity band' },
              { value: 'ai', label: 'Group by AI usage' },
              { value: 'department', label: 'Group by department' },
              { value: 'join', label: 'Group by join month' },
            ]} />
            <Select label="Trend metric" value={cohortMetric} onChange={setCohortMetric} options={METRIC_OPTIONS.map((o) => ({ ...o, label: `Track ${o.label.toLowerCase()}` }))} />
          </>}
          note={`Each line follows one group of people month by month. People with ${cfg.minPresentDaysForLists}+ present days. Groups are fixed on the whole period's behaviour, so you can see whether e.g. the low band was always low or slipped recently.`}>
          {cohortBy === 'band' && (
            <div className="band-ctl">
              <span>Bands on</span>
              <Select label="Band metric" value={bands.metric} options={METRIC_OPTIONS} onChange={(m) => setBands({ ...bands, metric: m })} />
              <span>under</span><NumberField label="Low cut-off" value={bands.low} suffix="h" onChange={(v) => setBands({ ...bands, low: v })} />
              <span>healthy to</span><NumberField label="High cut-off" value={bands.high} suffix="h" onChange={(v) => setBands({ ...bands, high: v })} />
              <span>over that is overburdened</span>
            </div>
          )}
          <div className="cohort-cards">
            {cohort.rows.slice(0, 8).map((r, i) => (
              <div key={r.name} className="cohort-card" style={{ borderTopColor: COHORT_COLORS[i % COHORT_COLORS.length] }}>
                <span className="cohort-name">{r.name}</span>
                <span className="cohort-n">{fmtN(r.people)} <small>people · {fmtPct((r.people / Math.max(1, reliable.length)) * 100)}</small></span>
                <span className="cohort-meta">{fmtH(r.avg, 2)} {METRIC_LABEL[cohortMetric].toLowerCase()} · AI {fmtPct(r.aiPct)}</span>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={cohort.months.map((m, mi) => Object.fromEntries([['month', m.label], ...cohort.rows.slice(0, 8).map((r) => [r.name, r.series[mi]])]))}
              margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...axisProps} unit="h" />
              <Tooltip />
              <Legend verticalAlign="top" height={36} />
              {cohort.rows.slice(0, 8).map((r, i) => (
                <Line key={r.name} dataKey={r.name} stroke={COHORT_COLORS[i % COHORT_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
          {cohortBy === 'department' && cohort.rows.length > 8 && <p className="muted small">Showing the 8 largest departments.</p>}
        </Section>
      </div>
    </>
  );
}
