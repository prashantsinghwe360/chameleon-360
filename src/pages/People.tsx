import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useDash } from '../state';
import {
  axisProps, CHART, DataTable, DetailHeader, NumberField, OP_OPTIONS, Section, Select, ThresholdControl,
} from '../components/ui';
import {
  compare, fmtH, fmtN, fmtPct, MEASURE_LABEL, MEASURE_SHORT, measureOf, METRIC_LABEL, pctDaysMeeting, redFlags, thresholdText, topItems,
  type PersonStat,
} from '../lib/metrics';
import { misTagCandidates } from '../lib/insights';
import type { PersonMeasure, RedFlagRule } from '../types';

const MEASURES = (Object.keys(MEASURE_LABEL) as PersonMeasure[]).map((m) => ({ value: m, label: MEASURE_LABEL[m].label }));
const barH = (n: number) => Math.max(220, n * 26 + 60);

/** Detail views opened from the people sections. */
export const PEOPLE_DETAILS = ['threshold', 'unproductive', 'redflags'];

/**
 * Individual-level sections (below-threshold list, unproductive visitors, red flags).
 * Renders the three cards, or the full detail page when one of PEOPLE_DETAILS is open.
 * Lives inside the Cohorts tab.
 */
export function PeopleSections() {
  const { ds, scope, stats, redFlag, setRedFlag, detail, openDetail, breakdown, team } = useDash();
  const perPerson = breakdown === 'person';
  const cfg = ds.config;
  const [t, setT] = useState(cfg.defaults.individualsThreshold);
  const minDays = cfg.minPresentDaysForLists;
  const [showN, setShowN] = useState(15);
  const [minUnprod, setMinUnprod] = useState(20);

  const asc = t.op === '<' || t.op === '<=';
  const list = useMemo(() => stats
    .filter((s) => s.presentDays >= minDays && compare(s.avg[t.metric], t.op, t.value))
    .sort((a, b) => (asc ? a.avg[t.metric] - b.avg[t.metric] : b.avg[t.metric] - a.avg[t.metric])), [stats, t, minDays, asc]);
  const cands = useMemo(() => new Set(misTagCandidates(topItems(scope, { productivity: 'unproductive', n: 30 }), cfg.nonWorkCategories).map((c) => c.name)), [scope, cfg]);
  const unprodPeople = useMemo(() => stats.filter((s) => s.unproductiveHrs >= minUnprod).sort((a, b) => b.unproductiveHrs - a.unproductiveHrs), [stats, minUnprod]);
  const flags = useMemo(() => redFlags(stats, redFlag, t), [stats, redFlag, t]);

  const ruleText = redFlag.rules.filter((r) => r.enabled)
    .map((r) => `${MEASURE_LABEL[r.measure].label.toLowerCase()} ${r.op} ${r.value}${MEASURE_LABEL[r.measure].unit}`).join(redFlag.combine === 'all' ? ' and ' : ' or ');
  const workHrs = (p: PersonStat) => Object.entries(p.unprodItems).filter(([n]) => cands.has(n)).reduce((a, [, h]) => a + h, 0);

  /* ------------------------------ charts ------------------------------ */
  const thresholdChart = (n: number) => {
    const data = list.slice(0, n).map((p) => ({ name: p.emp.name, dept: p.emp.department, value: +p.avg[t.metric].toFixed(2) }));
    if (!data.length) return <p className="empty">Nobody matches this filter.</p>;
    return (
      <ResponsiveContainer width="100%" height={barH(data.length)}>
        <BarChart data={data} layout="vertical" margin={{ top: 22, right: 50, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART.grid} horizontal={false} />
          <XAxis type="number" {...axisProps} unit="h" domain={[0, (max: number) => Math.max(max, t.value)]} />
          <YAxis type="category" dataKey="name" {...axisProps} width={170} interval={0} />
          <Tooltip formatter={(v: number) => [`${v}h`, `Avg ${METRIC_LABEL[t.metric].toLowerCase()}/day`]} labelFormatter={(l, p) => `${l} · ${p?.[0]?.payload?.dept ?? ''}`} />
          <ReferenceLine x={t.value} stroke={CHART.under} strokeDasharray="4 3" label={{ value: `${t.value}h`, position: 'top', fill: CHART.under, fontSize: 12 }} />
          <Bar dataKey="value" fill={CHART[t.metric]} radius={[0, 3, 3, 0]} label={{ position: 'right', fill: CHART.axis, fontSize: 12, formatter: (v: number) => `${v}h` }} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const unprodChart = (n: number) => {
    const data = unprodPeople.slice(0, n).map((p) => {
      const w = workHrs(p);
      return { name: p.emp.name, dept: p.emp.department, work: +w.toFixed(1), other: +(p.unproductiveHrs - w).toFixed(1) };
    });
    if (!data.length) return <p className="empty">Nobody above {minUnprod} h.</p>;
    return (
      <ResponsiveContainer width="100%" height={barH(data.length) + 30}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART.grid} horizontal={false} />
          <XAxis type="number" {...axisProps} unit="h" />
          <YAxis type="category" dataKey="name" {...axisProps} width={170} interval={0} />
          <Tooltip formatter={(v: number) => `${v} h`} labelFormatter={(l, p) => `${l} · ${p?.[0]?.payload?.dept ?? ''}`} />
          <Legend verticalAlign="top" height={30} />
          <Bar dataKey="work" name="Likely work tool (mis-tagged)" stackId="u" fill={CHART.misTag} />
          <Bar dataKey="other" name="Discretionary" stackId="u" fill={CHART.unproductive} radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const flagsByDept = useMemo(() => {
    const m = new Map<string, number>();
    if (perPerson) return flags.map(({ s }) => ({ name: s.emp.name, people: +s.avg.active.toFixed(2) })).sort((a, b) => a.people - b.people);
    flags.forEach(({ s }) => m.set(s.emp.department, (m.get(s.emp.department) ?? 0) + 1));
    return [...m.entries()].map(([name, people]) => ({ name, people })).sort((a, b) => b.people - a.people);
  }, [flags, perPerson]);
  const flagChart = flagsByDept.length ? (
    <ResponsiveContainer width="100%" height={barH(flagsByDept.length)}>
      <BarChart data={flagsByDept} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }} maxBarSize={26}>
        <CartesianGrid stroke={CHART.grid} horizontal={false} />
        <XAxis type="number" {...axisProps} allowDecimals={perPerson} unit={perPerson ? 'h' : undefined} />
        <YAxis type="category" dataKey="name" {...axisProps} width={180} interval={0} />
        <Tooltip formatter={(v: number) => (perPerson ? [`${v}h`, 'Avg active / day'] : [`${v} people`, 'Flagged'])} />
        <Bar dataKey="people" fill={CHART.under} radius={[0, 3, 3, 0]} label={{ position: 'right', fill: CHART.axis, fontSize: 12 }} />
      </BarChart>
    </ResponsiveContainer>
  ) : <p className="empty">Nobody meets these rules.</p>;

  /* ------------------------------ tables ------------------------------ */
  const thresholdTable = (
    <DataTable key={`${t.metric}${t.op}`} rows={list} max={50} initialSort={{ key: t.metric, dir: asc ? 'asc' : 'desc' }} cols={[
      { key: 'name', label: 'Name', get: (r) => r.emp.name },
      { key: 'dept', label: 'Department', get: (r) => r.emp.department },
      ...(['active', 'productive', 'online'] as const).map((m) => ({
        key: m, label: `${METRIC_LABEL[m]} hrs/day`, align: 'right' as const, get: (r: PersonStat) => r.avg[m],
        render: (r: PersonStat) => (m === t.metric ? <b>{fmtH(r.avg[m], 2)}</b> : fmtH(r.avg[m], 2)),
      })),
      { key: 'd', label: 'Present days', align: 'right', get: (r) => r.presentDays },
      { key: 'pct', label: '% days meeting', align: 'right', get: (r) => pctDaysMeeting(r, t), render: (r) => fmtPct(pctDaysMeeting(r, t)) },
    ]} />
  );
  const unprodTable = (
    <DataTable rows={unprodPeople} max={50} initialSort={{ key: 'u', dir: 'desc' }} cols={[
      { key: 'name', label: 'Name', get: (r) => r.emp.name },
      { key: 'dept', label: 'Department', get: (r) => r.emp.department },
      { key: 'u', label: 'Unproductive hrs', align: 'right', get: (r) => r.unproductiveHrs, render: (r) => fmtH(r.unproductiveHrs, 1) },
      { key: 'w', label: 'Of which work tools', align: 'right', get: workHrs, render: (r) => fmtH(workHrs(r), 1) },
      { key: 'top', label: 'Largest item', get: (r) => r.topUnproductive ?? '', render: (r) => <>{r.topUnproductive}{r.topUnproductive && cands.has(r.topUnproductive) && <span className="chip warn">Work tool</span>}</> },
      { key: 'a', label: 'Avg active hrs/day', align: 'right', get: (r) => r.avg.active, render: (r) => r.avg.active.toFixed(2) },
    ]} />
  );
  const flagTable = (
    <DataTable rows={flags} max={50} initialSort={{ key: 'a', dir: 'asc' }} empty="Nobody meets these rules." cols={[
      { key: 'name', label: 'Name', get: (r) => r.s.emp.name },
      { key: 'dept', label: 'Department', get: (r) => r.s.emp.department },
      { key: 'a', label: 'Avg active', align: 'right', get: (r) => r.s.avg.active, render: (r) => fmtH(r.s.avg.active, 2) },
      { key: 'p', label: 'Avg productive', align: 'right', get: (r) => r.s.avg.productive, render: (r) => fmtH(r.s.avg.productive, 2) },
      { key: 'd', label: 'Days', align: 'right', get: (r) => r.s.presentDays },
      { key: 'why', label: 'Rules hit', get: (r) => r.reasons.length, render: (r) => <span className="reasons">{r.reasons.map((m) => <span key={m} className="chip bad">{MEASURE_SHORT[m]}: {measureOf(r.s, m, t).toFixed(1)}{MEASURE_LABEL[m].unit}</span>)}</span> },
    ]} />
  );

  /* ------------------------------ controls ------------------------------ */
  const thresholdTools = <ThresholdControl value={t} onChange={setT} prefix="Average" />;
  const unprodTools = <><span className="ctl-label">At least</span><NumberField label="Minimum unproductive hours" value={minUnprod} step={5} suffix="h" onChange={setMinUnprod} /></>;
  const updateRule = (id: string, patch: Partial<RedFlagRule>) =>
    setRedFlag({ ...redFlag, rules: redFlag.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const shortPeriod = redFlag.minPresentDays > scope.range.workingDays;
  const ruleBuilder = (
    <>
      <div className="rules">
        <div className="rules-head">
          <span>Flag people with</span>
          <NumberField label="Minimum present days for red flags" value={redFlag.minPresentDays} step={5} onChange={(v) => setRedFlag({ ...redFlag, minPresentDays: Math.round(v) })} />
          <span>+ present days who meet</span>
          <Select label="Combine rules" value={redFlag.combine} onChange={(c) => setRedFlag({ ...redFlag, combine: c })}
            options={[{ value: 'all', label: 'all rules' }, { value: 'any', label: 'any rule' }]} />
        </div>
        {redFlag.rules.map((r) => (
          <div key={r.id} className={`rule ${r.enabled ? '' : 'off'}`}>
            <input type="checkbox" checked={r.enabled} aria-label="Use this rule" onChange={(e) => updateRule(r.id, { enabled: e.target.checked })} />
            <Select label="Measure" value={r.measure} options={MEASURES} onChange={(m) => updateRule(r.id, { measure: m })} />
            <Select label="Comparison" value={r.op} options={OP_OPTIONS} onChange={(op) => updateRule(r.id, { op })} />
            <NumberField label="Value" value={r.value} step={0.5} suffix={MEASURE_LABEL[r.measure].unit} onChange={(v) => updateRule(r.id, { value: v })} />
            <button className="icon-btn" aria-label="Remove rule" onClick={() => setRedFlag({ ...redFlag, rules: redFlag.rules.filter((x) => x.id !== r.id) })}><X size={14} /></button>
          </div>
        ))}
        <button className="add-rule" onClick={() => setRedFlag({ ...redFlag, rules: [...redFlag.rules, { id: `r${Date.now()}`, measure: 'avgProductive', op: '<', value: 2, enabled: true }] })}>
          <Plus size={14} aria-hidden /> Add rule
        </button>
      </div>
      {shortPeriod && (
        <div className="notice">
          The selected period has only {scope.range.workingDays} working days, so nobody can reach {redFlag.minPresentDays} present days.
          <button onClick={() => setRedFlag({ ...redFlag, minPresentDays: Math.max(1, Math.round(scope.range.workingDays * 0.4)) })}>
            Use {Math.max(1, Math.round(scope.range.workingDays * 0.4))} days (40% of the period)
          </button>
        </div>
      )}
      <div className="flag-count"><b>{fmtN(flags.length)}</b> people flagged</div>
    </>
  );

  /* ------------------------------ detail views ------------------------------ */
  if (detail === 'threshold') return (
    <>
      <DetailHeader title={`People averaging ${thresholdText(t)}`} lede={`${fmtN(list.length)} people with at least ${minDays} present days, sorted ${asc ? 'lowest' : 'highest'} first.`} />
      <div className="grid">
        <Section title={`${asc ? 'Lowest' : 'Highest'} ${Math.min(showN, list.length)}`}
          tools={<>{thresholdTools}<Select label="Bars" value={String(showN)} onChange={(v) => setShowN(Number(v))} options={['10', '15', '25', '50'].map((v) => ({ value: v, label: `Show ${v}` }))} /></>}>
          {thresholdChart(showN)}
        </Section>
        <Section title={`All ${fmtN(list.length)} people`} note="Select a column heading to sort.">{thresholdTable}</Section>
      </div>
    </>
  );
  if (detail === 'unproductive') return (
    <>
      <DetailHeader title="Who's visiting unproductive apps & websites" lede={`${fmtN(unprodPeople.length)} people with at least ${minUnprod} unproductive hours in the period.`} />
      <div className="grid">
        <Section title="Top 15 by unproductive hours" tools={unprodTools}
          note="Amber is time on unproductive-tagged items that several people use for work (likely mis-tagged); red is the rest.">
          {unprodChart(15)}
        </Section>
        <Section title={`All ${fmtN(unprodPeople.length)} people`}>{unprodTable}</Section>
      </div>
    </>
  );
  if (detail === 'redflags') return (
    <>
      <DetailHeader title="Red-flag employees" lede={`${fmtN(flags.length)} people meet: ${ruleText || 'no rules enabled'} (${redFlag.minPresentDays}+ present days).`} />
      <div className="grid">
        <Section title="Rules" note="Every enabled rule uses data already in the dashboard. Add rules as new red-flag metrics are agreed.">{ruleBuilder}</Section>
        <Section title={perPerson ? `Flagged people in ${team} (avg active / day)` : 'Flagged people by department'}>{flagChart}</Section>
        <Section title={`All ${fmtN(flags.length)} flagged people`}
          note="Sustained low activity can reflect role mismatch, disengagement, a device or tracking issue, or offline work - a starting point for a conversation.">
          {flagTable}
        </Section>
      </div>
    </>
  );

  /* ------------------------------ sections (rendered inside the Cohorts tab) ------------------------------ */
  return (
    <>
        <Section id="threshold" title={`People averaging ${thresholdText(t)}`} tools={thresholdTools}
          onOpen={() => openDetail('threshold', 'threshold')}
          note={`${fmtN(list.length)} people in total; the ${Math.min(10, list.length)} ${asc ? 'lowest' : 'highest'} are shown. Dashed line marks the threshold.`}>
          {thresholdChart(10)}
        </Section>

        <Section id="unproductive" span={6} title="Who's visiting unproductive apps & websites"
          onOpen={() => openDetail('unproductive', 'unproductive')}
          note="Top 10 by unproductive hours. Amber is likely a mis-tagged work tool.">
          {unprodChart(10)}
        </Section>

        <Section id="redflags" span={6} title="Red-flag employees" onOpen={() => openDetail('redflags', 'redflags')}
          note={`${perPerson ? `Flagged people in ${team}, by average active hours a day` : 'Flagged people by department'}. Rule: ${ruleText || 'none enabled'}. Edit rules in the detail view.`}>
          <div className="flag-count"><b>{fmtN(flags.length)}</b> people flagged</div>
          {shortPeriod && <div className="notice">Only {scope.range.workingDays} working days in this period - the rule needs {redFlag.minPresentDays}. Open the details to adjust.</div>}
          {flagChart}
        </Section>
    </>
  );
}
