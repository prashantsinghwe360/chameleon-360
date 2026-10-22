import { useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, ReferenceLine, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ALL_TEAMS, useDash } from '../state';
import {
  axisProps, CHART, DataTable, DetailHeader, InsightPanel, NumberField, PageHeader, Section, Select, ThresholdControl, METRIC_OPTIONS,

} from '../components/ui';
import {
  compare, fmtH, fmtPct, groupStats, METRIC_LABEL, monthlyTrend, monthsIn, orgAvg, thresholdText, type GroupStat,
} from '../lib/metrics';
import type { MetricKey } from '../types';
import { slate } from '../theme/tokens';


export function TeamsPage() {
  const { ds, scope, stats, under, setUnder, detail, openDetail, team, teamLabel, rulesFor, breakdown, groupNoun, GroupNoun } = useDash();
  const perPerson = breakdown === 'person';
  const cfg = ds.config;
  const [lbChoice, setLbChoice] = useState<'department' | 'team'>('department');
  // with one team selected the leaderboard ranks people
  const lbGroup: 'department' | 'team' | 'person' = perPerson ? 'person' : lbChoice;
  const [leaders, setLeaders] = useState(cfg.defaults.leaderCount);
  const [tableMetric, setTableMetric] = useState<MetricKey>('active');

  // one row per department, or per person when a single team is selected
  const depts = useMemo(() => groupStats(stats, breakdown, under, cfg.minGroupSize, 1), [stats, under, cfg, breakdown, perPerson]);
  const teams = useMemo(() => groupStats(stats, 'team', under, team === ALL_TEAMS ? cfg.minGroupSize : 1), [stats, under, cfg, team]);
  const trend = useMemo(() => monthlyTrend(scope, stats), [scope, stats]);
  const org = useMemo(() => orgAvg(stats), [stats]);
  const deptMonths = useMemo(() => {
    const months = monthsIn(scope);
    const names = new Set(depts.map((d) => d.name));
    const by = new Map<string, typeof stats>();
    const keyOf = (s: (typeof stats)[number]) => (perPerson ? s.emp.name : s.emp.department);
    stats.forEach((s) => { const k = keyOf(s); if (names.has(k)) by.set(k, [...(by.get(k) ?? []), s]); });
    const rows = [...by.entries()].map(([name, list]) => ({
      name,
      values: months.map((m) => {
        let n = 0, v = 0;
        list.forEach((p) => { const x = p.months[m.key]; if (x) { n += x.present; v += x[tableMetric]; } });
        return n ? v / 3600 / n : null;
      }),
    })).sort((a, b) => a.name.localeCompare(b.name));
    return { months, rows };
  }, [scope, stats, depts, tableMetric, perPerson]);
  const patterns = [...depts].sort((a, b) => a.avg[under.metric] - b.avg[under.metric])
    .map((g) => ({ name: g.name, value: +g.avg[under.metric].toFixed(2), meeting: g.meeting }));
  const comp = [...depts].sort((a, b) => b.prodPct - a.prodPct)
    .map((g) => ({ name: g.name, Productive: +g.prodPct.toFixed(1), Neutral: +g.neutralPct.toFixed(1), Unproductive: +g.unprodPct.toFixed(1) }));
  // leaderboard follows the graph's metric and threshold
  const rankVal = (g: GroupStat) => g.avg[under.metric];
  const ranked = [...(lbGroup === 'team' ? teams : depts)].sort((a, b) => rankVal(b) - rankVal(a)).map((g, i) => ({ ...g, rank: i + 1 }));
  const n = Math.min(leaders, Math.floor(ranked.length / 2));

  const insights = rulesFor('teams');

  /* ------------------------------ charts (shared by tab + detail) ------------------------------ */
  const hTop = Math.ceil(Math.max(under.value, ...patterns.map((p) => p.value), 1));
  const patternsChart = (h: number) => (
        <div className={perPerson ? 'chart-scroll' : undefined}>
          <div style={perPerson ? { minWidth: Math.max(600, patterns.length * 34) } : undefined}>
          <ResponsiveContainer width="100%" height={h}>
            <ComposedChart data={patterns} margin={{ top: 10, right: 10, bottom: 70, left: 40 }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="name" {...axisProps} angle={-35} textAnchor="end" interval={0} height={80} />
              <YAxis yAxisId="h" {...axisProps} unit="h" domain={[0, hTop]} ticks={Array.from({ length: hTop + 1 }, (_, i) => i)} />
              {!perPerson && <YAxis yAxisId="c" orientation="right" {...axisProps} allowDecimals={false} />}
              <Tooltip />
              <Legend verticalAlign="top" height={28} />
              <Bar yAxisId="h" dataKey="value" name={`Avg. ${METRIC_LABEL[under.metric].toLowerCase()} hrs/day`} fill={CHART[under.metric]} radius={[3, 3, 0, 0]}>
                {perPerson && patterns.map((p) => <Cell key={p.name} fill={compare(p.value, under.op, under.value) ? CHART.under : CHART[under.metric]} />)}
              </Bar>
              <ReferenceLine yAxisId="h" y={under.value} stroke={CHART.under} strokeDasharray="5 4" strokeWidth={1.5}
                label={{ value: `${under.value}h baseline`, position: 'insideTopLeft', fill: CHART.under, fontSize: 12, fontWeight: 700 }} />
              {!perPerson && <Line yAxisId="c" dataKey="meeting" name={`People ${thresholdText(under)}`} stroke={slate[700]} strokeWidth={2} dot={{ r: 3, fill: slate[700] }} />}
            </ComposedChart>
          </ResponsiveContainer>
          </div>
        </div>
  );
  const monthlyChart = (h: number) => (
          <ResponsiveContainer width="100%" height={h}>
            <BarChart data={trend} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...axisProps} unit="h" />
              <Tooltip />
              <Legend verticalAlign="top" height={28} />
              <Bar dataKey="online" name="Online" fill={CHART.online} radius={[3, 3, 0, 0]} />
              <Bar dataKey="active" name="Active" fill={CHART.active} radius={[3, 3, 0, 0]} />
              <Bar dataKey="productive" name="Productive" fill={CHART.productive} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
  );
  const compChart = () => (
          <ResponsiveContainer width="100%" height={Math.max(300, comp.length * 26 + 40)}>
            <BarChart data={comp} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 0 }} barCategoryGap={3}>
              <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} allowDataOverflow {...axisProps} unit="%" />
              <YAxis type="category" dataKey="name" {...axisProps} width={160} interval={0} tick={{ fill: CHART.axis, fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Legend verticalAlign="top" height={28} />
              <Bar dataKey="Productive" stackId="a" fill={CHART.productive} />
              <Bar dataKey="Neutral" stackId="a" fill={CHART.neutral} />
              <Bar dataKey="Unproductive" stackId="a" fill={CHART.unproductive} />
            </BarChart>
          </ResponsiveContainer>
  );

  /* ------------------------------ detail views ------------------------------ */
  const metricSel = <Select label="Table metric" value={tableMetric} onChange={setTableMetric} options={METRIC_OPTIONS.map((o) => ({ ...o, label: `Table: ${o.label.toLowerCase()}` }))} />;

  if (detail === 'patterns') return (
    <>
      <DetailHeader title={perPerson ? `${team}: activity by person` : 'Department-wise activity patterns'} lede={`Average hours per present day and people ${thresholdText(under)}, for ${teamLabel}.`} />
      <div className="grid">
        <Section title={perPerson ? 'People, lowest to highest' : 'Departments, lowest to highest'} tools={<ThresholdControl value={under} onChange={setUnder} prefix="Count people averaging" />}>
          {patternsChart(400)}
        </Section>
        <Section title={perPerson ? `${team} leaderboard` : 'Team leaderboard'}
          tools={<>
            {!perPerson && <Select label="Leaderboard groups" value={lbChoice} onChange={setLbChoice} options={[{ value: 'department', label: 'By department' }, { value: 'team', label: 'By team' }]} />}
            <span className="ctl-label">Highlight top / bottom</span>
            <NumberField label="Highlight count" value={leaders} step={1} min={1} onChange={(v) => setLeaders(Math.max(1, Math.round(v)))} />
          </>}
          note={`Ranked by average ${METRIC_LABEL[under.metric].toLowerCase()} hours per present day, the metric set on the graph. An activity signal from computer use, not a performance rating.`}>
          <div className="legend-inline"><span className="chip good">Top {n}</span><span className="chip bad">Bottom {n}</span></div>
          <DataTable key={`${lbGroup}${under.metric}`} rows={ranked} rowClass={(_, i) => (i < n ? 'row-good' : i >= ranked.length - n ? 'row-bad' : '')}
            cols={[
              { key: 'rank', label: '#', get: (r) => r.rank },
              { key: 'name', label: lbGroup === 'person' ? 'Person' : lbGroup === 'department' ? 'Department' : 'Team', get: (r) => r.name },
              ...(perPerson ? [] : [{ key: 'people', label: 'People', align: 'right' as const, get: (r: GroupStat) => r.people }]),
              ...(['active', 'productive', 'online'] as const).map((m) => ({
                key: m, label: `Avg ${METRIC_LABEL[m].toLowerCase()} hrs`, align: 'right' as const, get: (r: GroupStat) => r.avg[m],
                render: (r: GroupStat) => (m === under.metric ? <b>{fmtH(r.avg[m], 2)}</b> : fmtH(r.avg[m], 2)),
              })),
              { key: 'gap', label: 'Idle gap', align: 'right', get: (r) => r.avg.online - r.avg.active, render: (r) => fmtH(r.avg.online - r.avg.active, 2) },
              { key: 'prod', label: 'Productive %', align: 'right', get: (r) => r.prodPct, render: (r) => fmtPct(r.prodPct, 1) },
              ...(perPerson
                ? [{ key: 'meet', label: `Below baseline (${thresholdText(under)})`, align: 'right' as const, get: (r: GroupStat) => r.meeting,
                    render: (r: GroupStat) => (r.meeting ? <span className="chip bad">Yes</span> : <span className="muted">No</span>) }]
                : [
                  { key: 'meet', label: `People ${thresholdText(under)}`, align: 'right' as const, get: (r: GroupStat) => r.meeting },
                  { key: 'pct', label: '% of group', align: 'right' as const, get: (r: GroupStat) => r.meetingPct, render: (r: GroupStat) => fmtPct(r.meetingPct) },
                ]),
            ]} />
        </Section>
      </div>
    </>
  );

  if (detail === 'monthly') return (
    <>
      <DetailHeader title={`${trend[0]?.weekly ? 'Week' : 'Month'}-wise online, active & productive time`} lede={`Average hours per present day for ${teamLabel}.`} />
      <div className="grid">
        <Section title="Trend">{monthlyChart(340)}</Section>
        <Section span={6} title={`By ${trend[0]?.weekly ? 'week' : 'month'}`} note="* marks a month only partly inside the selected period. Idle gap = online minus active.">
          <DataTable rows={trend} cols={[
            { key: 'month', label: trend[0]?.weekly ? 'Week' : 'Month', get: (r) => r.month },
            { key: 'online', label: 'Online', align: 'right', get: (r) => r.online, render: (r) => fmtH(r.online, 2) },
            { key: 'active', label: 'Active', align: 'right', get: (r) => r.active, render: (r) => fmtH(r.active, 2) },
            { key: 'productive', label: 'Productive', align: 'right', get: (r) => r.productive, render: (r) => fmtH(r.productive, 2) },
            { key: 'gap', label: 'Idle gap', align: 'right', get: (r) => r.online - r.active, render: (r) => fmtH(r.online - r.active, 2) },
            { key: 'pp', label: 'Prod. %', align: 'right', get: (r) => (r.active ? r.productive / r.active : 0), render: (r) => fmtPct(r.active ? (r.productive / r.active) * 100 : 0) },
          ]} />
        </Section>
        <Section span={6} title={`${GroupNoun} by month`} tools={metricSel}
          note={`Average ${METRIC_LABEL[tableMetric].toLowerCase()} hours per present day. Red cells are below the period average of ${fmtH(org[tableMetric], 2)}.`}>
          <div className="table-wrap">
            <table>
              <thead><tr><th><button>{GroupNoun}</button></th>{deptMonths.months.map((m) => <th key={m.key} className="r"><button>{m.label}</button></th>)}</tr></thead>
              <tbody>
                {deptMonths.rows.map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    {r.values.map((v, i) => <td key={i} className={`r ${v !== null && v < org[tableMetric] ? 'cell-low' : ''}`}>{v === null ? '–' : v.toFixed(2)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </>
  );

  if (detail === 'composition') return (
    <>
      <DetailHeader title="Activity & productivity composition" lede={`Share of each ${groupNoun}'s active time by productivity tag, for ${teamLabel}.`} />
      <div className="grid">
        <Section title="Composition, most productive first">{compChart()}</Section>
        <Section title={`All ${depts.length} ${perPerson ? 'people' : 'departments'}`} note="Shares use the client's productivity tagging; a high unproductive share often points to a mis-tagged work tool.">
          <DataTable rows={depts} initialSort={{ key: 'prod', dir: 'desc' }} rowClass={(r) => (r.unprodPct > 5 ? 'row-bad' : '')} cols={[
            { key: 'name', label: GroupNoun, get: (r) => r.name },
            ...(perPerson ? [] : [{ key: 'people', label: 'People', align: 'right' as const, get: (r: GroupStat) => r.people }]),
            { key: 'prod', label: 'Productive %', align: 'right', get: (r) => r.prodPct, render: (r) => fmtPct(r.prodPct, 1) },
            { key: 'neu', label: 'Neutral %', align: 'right', get: (r) => r.neutralPct, render: (r) => fmtPct(r.neutralPct, 1) },
            { key: 'unp', label: 'Unproductive %', align: 'right', get: (r) => r.unprodPct, render: (r) => fmtPct(r.unprodPct, 1) },
            { key: 'ph', label: 'Productive hrs/day', align: 'right', get: (r) => r.avg.productive, render: (r) => fmtH(r.avg.productive, 2) },
            { key: 'ah', label: 'Active hrs/day', align: 'right', get: (r) => r.avg.active, render: (r) => fmtH(r.avg.active, 2) },
          ]} />
        </Section>
      </div>
    </>
  );


  return (
    <>
      <PageHeader title="Teams" lede={perPerson ? `${team}: how each person compares and how the month-by-month picture moves. Open the activity patterns for the leaderboard.` : 'How departments and teams compare and how the month-by-month picture moves. Open the activity patterns for the team leaderboard.'} />
      <InsightPanel items={insights} />

      <div className="grid">
        <Section id="patterns" title={perPerson ? `${team}: activity by person` : 'Department-wise activity patterns'} onOpen={() => openDetail('patterns', 'patterns')}
          tools={<ThresholdControl value={under} onChange={setUnder} prefix="Count people averaging" />}
          note={perPerson
            ? `Each bar is one person's average ${METRIC_LABEL[under.metric].toLowerCase()} hours per present day; coral bars are ${thresholdText(under)}. ${depts.length} people in ${team}.`
            : `Bars: average ${METRIC_LABEL[under.metric].toLowerCase()} hours per present day. Line: people whose average is ${thresholdText(under)}. ${depts.length} departments with ${cfg.minGroupSize}+ people.`}>
          {patternsChart(340)}
        </Section>

        <Section id="monthly" span={7} onOpen={() => openDetail('monthly', 'monthly')} title={`${trend[0]?.weekly ? 'Week' : 'Month'}-wise online, active & productive time`}
          note={trend[0]?.weekly ? 'Average hours per present day, by week (short periods switch to weekly).' : 'Average hours per present day. * marks a month only partly inside the selected period.'}>
          {monthlyChart(300)}
        </Section>

        <Section id="composition" span={5} title={perPerson ? 'Composition by person' : 'Activity & productivity composition'} onOpen={() => openDetail('composition', 'composition')}
          note={`Share of each ${groupNoun}'s active time by the client's productivity tagging, normalised to 100%.`}>
          {compChart()}
        </Section>


      </div>
    </>
  );
}
