import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useDash } from '../state';
import {
  axisProps, CHART, DataTable, DetailHeader, InsightPanel, METRIC_OPTIONS, NumberField, PageHeader, Section, Select, Stat,
} from '../components/ui';
import { capacity, fmtH, fmtN, fmtPct, H, METRIC_LABEL, type PersonStat } from '../lib/metrics';
import { family, wellness } from '../theme/tokens';
import type { MetricKey } from '../types';

const STRIPE_ID = 'cap-break-stripe';
type Status = 'under' | 'healthy' | 'over';
const STATUS_LABEL: Record<Status, string> = { under: 'Underutilised', healthy: 'Healthy', over: 'Overburdened' };
const STATUS_COLOR: Record<Status, string> = { under: wellness.underutilised, healthy: wellness.healthy, over: wellness.overburdened };
/** Light tone of the healthy colour for the band, base tone for the benchmark line (design-system triad). */
const BAND_FILL = family.tealGreen.light;
const LINE_COLOR = family.tealGreen.base;

export function CapacityPage() {
  const { ds, scope, stats, detail, openDetail, teamLabel, capacityCfg, setCapacityCfg, rulesFor, breakdown, team, GroupNoun } = useDash();
  const perPerson = breakdown === 'person';
  const cfg = ds.config;
  // shared with the decision rules, so Overview and this tab always agree
  const { metric, benchmark, variancePct: variance } = capacityCfg;
  const setMetric = (m: MetricKey) => setCapacityCfg({ ...capacityCfg, metric: m });
  const setBenchmark = (v: number) => setCapacityCfg({ ...capacityCfg, benchmark: v });
  const setVariance = (v: number) => setCapacityCfg({ ...capacityCfg, variancePct: v });

  const min = +(benchmark * (1 - variance / 100)).toFixed(2);
  const max = +(benchmark * (1 + variance / 100)).toFixed(2);
  const wd = scope.range.workingDays;
  const headcount = scope.employees.length;
  const status = (v: number): Status => (v < min ? 'under' : v > max ? 'over' : 'healthy');
  const label = METRIC_LABEL[metric].toLowerCase();

  /* ------------------------------ org capacity ------------------------------ */
  // ideal = headcount x working days x benchmark; actual = all recorded hours on the metric
  const actualHrs = useMemo(() => {
    const key = metric === 'online' ? 'onlineSec' : metric === 'active' ? 'activeSec' : 'productiveSec';
    return scope.daily.reduce((a, d) => a + (d.present ? H(d[key]) : 0), 0);
  }, [scope, metric]);
  const idealHrs = headcount * wd * benchmark;
  const usedPct = idealHrs ? (actualHrs / idealHrs) * 100 : 0;

  // people by status on their own average per present day
  const counted = useMemo(() => stats.filter((p) => p.presentDays > 0), [stats]);
  const split = useMemo(() => {
    const c: Record<Status, number> = { under: 0, healthy: 0, over: 0 };
    counted.forEach((p) => c[status(p.avg[metric])]++);
    return c;
  }, [counted, metric, min, max]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ------------------------------ departments ------------------------------ */
  const depts = useMemo(() => {
    // one row per department, or per person when a single team is selected
    const rows = capacity(scope, benchmark, breakdown).filter((d) => perPerson || d.people >= cfg.minGroupSize);
    const byDept = new Map<string, PersonStat[]>();
    const keyOf = (p: PersonStat) => (perPerson ? p.emp.name : p.emp.department);
    counted.forEach((p) => byDept.set(keyOf(p), [...(byDept.get(keyOf(p)) ?? []), p]));
    return rows.map((r) => {
      const list = byDept.get(r.name) ?? [];
      const c: Record<Status, number> = { under: 0, healthy: 0, over: 0 };
      list.forEach((p) => c[status(p.avg[metric])]++);
      const value = r[metric];
      const deptHeadcount = perPerson ? 1 : scope.employees.filter((e) => e.department === r.name).length;
      const ideal = deptHeadcount * wd * benchmark;
      const actual = value * r.presentDays;
      return {
        name: r.name, people: deptHeadcount, value: +value.toFixed(2), status: status(value),
        under: c.under, healthy: c.healthy, over: c.over, ideal, actual, usedPct: ideal ? (actual / ideal) * 100 : 0,
      };
    }).sort((a, b) => a.value - b.value);
  }, [scope, counted, metric, benchmark, min, max, wd, cfg, breakdown, perPerson]); // eslint-disable-line react-hooks/exhaustive-deps
  type DeptRow = (typeof depts)[number];

  const axisMax = Math.ceil(Math.max(max + 0.5, ...depts.map((d) => d.value)));
  const deptChart = (h: number) => (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={depts} layout="vertical" margin={{ top: 20, right: 50, bottom: 0, left: 0 }} maxBarSize={22}>
        <CartesianGrid stroke={CHART.grid} horizontal={false} />
        <ReferenceArea x1={min} x2={max} fill={BAND_FILL} fillOpacity={0.3} stroke="none"
          label={{ value: `Healthy ${min}–${max}h`, position: 'insideTop', fill: family.tealGreen.dark, fontSize: 12, fontWeight: 700, dy: -18 }} />
        <ReferenceLine x={benchmark} stroke={LINE_COLOR} strokeWidth={2} strokeDasharray="6 4" />
        <XAxis type="number" {...axisProps} unit="h" domain={[0, axisMax]} ticks={Array.from({ length: axisMax + 1 }, (_, i) => i)} />
        <YAxis type="category" dataKey="name" {...axisProps} width={180} interval={0} />
        <Tooltip cursor={{ fill: 'rgba(229, 223, 255, .35)' }} content={({ active, payload }) => {
          if (!active || !payload?.length) return null;
          const d = payload[0].payload as DeptRow;
          return (
            <div className="chart-tip">
              <b>{d.name}</b>
              <span>{fmtH(d.value, 2)} {label} / day · <span style={{ color: STATUS_COLOR[d.status], fontWeight: 700 }}>{STATUS_LABEL[d.status]}</span></span>
              {!perPerson && <span className="muted">{d.healthy} healthy · {d.under} underutilised · {d.over} overburdened</span>}
              <span className="muted">{fmtPct(d.usedPct)} of ideal capacity used</span>
            </div>
          );
        }} />
        <Bar dataKey="value" radius={[0, 3, 3, 0]} label={{ position: 'right', fill: CHART.axis, fontSize: 12, formatter: (v: number) => `${v}h` }}>
          {depts.map((d) => <Cell key={d.name} fill={STATUS_COLOR[d.status]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
  const legend = (
    <div className="legend-inline">
      <span className="legend-dot"><i style={{ background: BAND_FILL }} />Healthy band {min}–{max}h</span>
      <span className="legend-dot"><i style={{ background: LINE_COLOR, borderRadius: 1, height: 3, width: 14 }} />Benchmark {benchmark}h</span>
      {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <span key={s} className="legend-dot"><i style={{ background: STATUS_COLOR[s] }} />{STATUS_LABEL[s]}</span>)}
    </div>
  );

  const controls = (
    <div className="bench-ctl" role="group" aria-label="Capacity benchmark">
      <span>Benchmark</span>
      <Select label="Benchmark metric" value={metric} onChange={setMetric} options={METRIC_OPTIONS.map((o) => ({ ...o, label: `Avg ${o.label.toLowerCase()}` }))} />
      <NumberField label="Benchmark hours per day" value={benchmark} step={0.5} min={1} suffix="h/day" onChange={(v) => setBenchmark(Math.max(0.5, v))} />
      <span>±</span>
      <NumberField label="Variance percent" value={variance} step={1} min={0} suffix="%" onChange={(v) => setVariance(Math.max(0, Math.min(90, v)))} />
      <span className="bench-range">Healthy {min}h – {max}h</span>
    </div>
  );

  /* ------------------------------ department detail ------------------------------ */
  if (detail === 'depts') return (
    <>
      <DetailHeader title={perPerson ? `${team}: capacity by person` : 'Capacity by department'} lede={`Average ${label} hours per present day against the ${benchmark}h benchmark (±${variance}%), for ${teamLabel}.`}>{controls}</DetailHeader>
      <div className="grid">
        <Section title={perPerson ? 'People against the healthy band' : 'Departments against the healthy band'}>{legend}{deptChart(Math.max(280, depts.length * 28 + 60))}</Section>
        <Section title={`All ${depts.length} ${perPerson ? 'people' : 'departments'}`} note={`Ideal capacity = headcount × ${wd} working days × ${benchmark}h. People are classed on their own average ${label} hours per present day.`}>
          <DataTable rows={depts} initialSort={{ key: 'v', dir: 'asc' }} rowClass={(r) => (r.status === 'under' ? 'row-bad' : r.status === 'over' ? 'row-warn' : '')} cols={[
            { key: 'name', label: GroupNoun, get: (r) => r.name },
            ...(perPerson ? [] : [{ key: 'people', label: 'Headcount', align: 'right' as const, get: (r: DeptRow) => r.people }]),
            { key: 'v', label: `Avg ${label}/day`, align: 'right', get: (r) => r.value, render: (r) => <b>{fmtH(r.value, 2)}</b> },
            { key: 's', label: 'Status', get: (r) => r.status, render: (r) => <span className={`chip st-${r.status}`}>{STATUS_LABEL[r.status]}</span> },
            ...(perPerson ? [] : [
              { key: 'h', label: 'Healthy', align: 'right' as const, get: (r: DeptRow) => r.healthy },
              { key: 'u', label: 'Under', align: 'right' as const, get: (r: DeptRow) => r.under },
              { key: 'o', label: 'Over', align: 'right' as const, get: (r: DeptRow) => r.over },
            ]),
            { key: 'ideal', label: 'Ideal hrs', align: 'right', get: (r) => r.ideal, render: (r) => fmtN(r.ideal) },
            { key: 'actual', label: 'Actual hrs', align: 'right', get: (r) => r.actual, render: (r) => fmtN(r.actual) },
            { key: 'used', label: 'Capacity used', align: 'right', get: (r) => r.usedPct, render: (r) => fmtPct(r.usedPct) },
          ]} />
        </Section>
      </div>
    </>
  );

  /* ------------------------------ where the day goes ------------------------------ */
  const all = capacity(scope, benchmark)[0];
  const day = all ? [{
    name: 'Average day',
    productive: +all.productive.toFixed(2),
    otherActive: +Math.max(0, all.active - all.productive).toFixed(2),
    idle: +Math.max(0, all.online - all.active).toFixed(2),
    brk: +Math.max(0, all.span - all.online).toFixed(2),
  }] : [];

  /* ------------------------------ insights ------------------------------ */
  const insights = rulesFor('capacity');

  const totalPeople = Math.max(1, counted.length);
  return (
    <>
      <PageHeader title="Time & Capacity" lede="How much of the workforce's capacity is used against a daily benchmark, and how the working day is spent." />
      <InsightPanel items={insights} />
      <div className="grid">
        <Section id="lens" title="Capacity lens" tools={controls}
          note={`Ideal capacity = headcount × working days × benchmark = ${fmtN(headcount)} × ${wd} × ${benchmark}h. The healthy band is the benchmark ±${variance}%. Directional, not a staffing recommendation.`}>
          <div className="lens-stats">
            <div className="lens-stat" style={{ borderTopColor: CHART.axis }}>
              <span className="lens-label">Ideal capacity</span>
              <span className="lens-value">{fmtN(idealHrs)}<small> h</small></span>
              <span className="lens-sub">{fmtN(headcount)} people × {wd} working days × {benchmark}h</span>
            </div>
            <div className="lens-stat" style={{ borderTopColor: CHART[metric] }}>
              <span className="lens-label">Actual {label} time</span>
              <span className="lens-value">{fmtN(actualHrs)}<small> h</small></span>
              <span className="lens-sub">Recorded across all present days</span>
            </div>
            <div className="lens-stat" style={{ borderTopColor: STATUS_COLOR[status((usedPct / 100) * benchmark)] }}>
              <span className="lens-label">Capacity used</span>
              <span className="lens-value" style={{ color: STATUS_COLOR[status((usedPct / 100) * benchmark)] }}>{fmtPct(usedPct)}</span>
              <span className="lens-sub">Healthy is {fmtPct(100 - variance)}–{fmtPct(100 + variance)} of ideal</span>
            </div>
          </div>

          <div className="status-split">
            <span className="presence-title">{fmtN(counted.length)} people by their average {label} hours per present day</span>
            <div className="status-bar" role="img" aria-label={`${split.under} underutilised, ${split.healthy} healthy, ${split.over} overburdened`}>
              {(['under', 'healthy', 'over'] as Status[]).map((s) => split[s] > 0 && (
                <i key={s} style={{ width: `${(split[s] / totalPeople) * 100}%`, background: STATUS_COLOR[s] }} />
              ))}
            </div>
            <div className="status-legend">
              <span><b style={{ color: STATUS_COLOR.under }}>{fmtN(split.under)}</b> underutilised · below {min}h</span>
              <span><b style={{ color: STATUS_COLOR.healthy }}>{fmtN(split.healthy)}</b> healthy · {min}–{max}h</span>
              <span><b style={{ color: STATUS_COLOR.over }}>{fmtN(split.over)}</b> overburdened · above {max}h</span>
            </div>
          </div>
        </Section>

        <Section id="depts" title={perPerson ? `${team}: capacity by person` : 'Capacity by department'} onOpen={() => openDetail('depts', 'depts')}
          note={`Average ${label} hours per present day. The light band is the healthy range (${min}–${max}h) and the line is the ${benchmark}h benchmark; bars are coloured by status.`}>
          {legend}
          {deptChart(Math.max(280, depts.length * 26 + 60))}
        </Section>

        {all && (
          <Section id="day" title="Where the working day goes"
            note={`Average hours per present day. The dashed teal line is the ${benchmark}h benchmark. Working (punched in) = online + break / offline; online = active + idle; active = productive + the rest.`}>
            <div className="stat-row">
              <Stat value={fmtH(all.span, 2)} label="punched in (span)" />
              <Stat value={fmtH(all.online, 2)} label="online" />
              <Stat value={fmtH(all.active, 2)} label="active" />
              <Stat value={fmtH(all.productive, 2)} label="productive" />
            </div>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={day} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }} barSize={44}>
                <defs>
                  <pattern id={STRIPE_ID} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="8" height="8" fill={family.yellow.light} />
                    <rect width="3" height="8" fill={family.amber.base} />
                  </pattern>
                </defs>
                <XAxis type="number" {...axisProps} unit="h" domain={[0, Math.ceil(all.span)]} />
                <YAxis type="category" dataKey="name" hide />
                <Tooltip formatter={(v: number) => `${v}h`} cursor={false} />
                <Legend verticalAlign="top" height={30} />
                <Bar dataKey="productive" name="Productive" stackId="d" fill={CHART.productive} />
                <Bar dataKey="otherActive" name="Active, not productive" stackId="d" fill={CHART.active} />
                <Bar dataKey="idle" name="Idle (online, no input)" stackId="d" fill={CHART.idle} />
                <Bar dataKey="brk" name="Break / offline (punched in, not online)" stackId="d" fill={`url(#${STRIPE_ID})`} radius={[0, 4, 4, 0]} />
                <ReferenceLine x={benchmark} stroke={LINE_COLOR} strokeWidth={2} strokeDasharray="6 4" />
              </BarChart>
            </ResponsiveContainer>
          </Section>
        )}
      </div>
    </>
  );
}
