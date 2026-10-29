import { useMemo } from 'react';
import { CapacityKpis, CapacityLensView, TeamsGlance } from '../components/capacityViews';
import { Bar, BarChart, CartesianGrid, Cell, Legend, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useDash } from '../state';
import {
  axisProps, CHART, DataTable, DetailHeader, InsightPanel, METRIC_OPTIONS, NumberField, PageHeader, Section, Select, Stat,
} from '../components/ui';
import { capacity, capacityBand, capacityBreakdown, fmtH, fmtN, fmtPct, METRIC_LABEL, type CapacityBreakdown, type PersonStat } from '../lib/metrics';
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
  const { ds, scope, stats, detail, openDetail, teamLabel, capacityCfg, setCapacityCfg, rulesFor, breakdown, team, GroupNoun, org: org_, teamOf, openTeam, setTeam } = useDash();
  const perPerson = breakdown === 'person';
  const teamClicks = !perPerson && org_.teamsOnly;
  /** team bar / row: from the tab open that team's detail page; on a detail page switch the filter */
  const drill = (name: string | undefined, to: string) => {
    const t = name && teamClicks ? teamOf(name) : null;
    if (!t) return;
    if (detail) setTeam(t); else openTeam(t, to, to);
  };
  const rowTitle = (r: { name: string }) => (teamClicks && teamOf(r.name) ? `Show ${r.name}'s people` : undefined);
  const cfg = ds.config;
  // shared with the decision rules, so Overview and this tab always agree
  const { metric, benchmark, variancePct: variance } = capacityCfg;
  const { min, max } = capacityBand(capacityCfg);
  const setMetric = (m: MetricKey) => setCapacityCfg({ ...capacityCfg, metric: m });
  // moving the benchmark keeps the band's shape (scales min and max with it)
  const setBenchmark = (v: number) => setCapacityCfg({ ...capacityCfg, benchmark: v, min: +(min * v / benchmark).toFixed(2), max: +(max * v / benchmark).toFixed(2) });
  // ± variance sets a symmetric band; min / max can also be typed directly
  const setVariance = (v: number) => setCapacityCfg({ ...capacityCfg, variancePct: v, min: +(benchmark * (1 - v / 100)).toFixed(2), max: +(benchmark * (1 + v / 100)).toFixed(2) });
  const setMin = (v: number) => setCapacityCfg({ ...capacityCfg, min: Math.min(v, max) });
  const setMax = (v: number) => setCapacityCfg({ ...capacityCfg, max: Math.max(v, min) });
  const wd = scope.range.workingDays;
  const headcount = scope.employees.length;
  const status = (v: number): Status => (v < min ? 'under' : v > max ? 'over' : 'healthy');
  const label = METRIC_LABEL[metric].toLowerCase();

  /* ------------------------------ org capacity ------------------------------ */
  // ideal = headcount x working days x benchmark; actual = all recorded hours on the metric
  // Ideal = benchmark x person-days (headcount x working days); Achieved = Ideal - Absence - Shortfall + Extra
  const org = useMemo(() => capacityBreakdown(scope, capacityCfg)[0], [scope, capacityCfg]);
  const byGroup = useMemo(() => capacityBreakdown(scope, capacityCfg, breakdown).sort((a, b) => a.deviation / Math.max(1, a.ideal) - b.deviation / Math.max(1, b.ideal)), [scope, capacityCfg, breakdown]);

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
        <Bar dataKey="value" radius={[0, 3, 3, 0]} label={{ position: 'right', fill: CHART.axis, fontSize: 12, formatter: (v: number) => `${v}h` }}
          cursor={teamClicks ? 'pointer' : undefined} onClick={(d: { name?: string; payload?: { name?: string } }) => drill(d?.payload?.name ?? d?.name, 'depts')}>
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
      <span className="bench-range">Healthy</span>
      <NumberField label="Healthy band minimum" value={min} step={0.25} min={0} suffix="h" onChange={setMin} />
      <span>–</span>
      <NumberField label="Healthy band maximum" value={max} step={0.25} min={0} suffix="h" onChange={setMax} />
    </div>
  );

  /* ------------------------------ capacity breakdown ------------------------------ */
  // hours -> people: how many full-time people (benchmark x working days) the hours are worth
  const perHead = benchmark * Math.max(1, wd);
  const fte = (h: number) => h / perHead;
  const fmtFte = (n: number) => (Math.abs(n) >= 10 ? Math.round(n).toLocaleString('en-US') : n.toFixed(1));

  if (detail === 'breakdown' && org) {
    const reasonKeys = [...new Set(byGroup.flatMap((g) => Object.keys(g.absenceByReason)))].sort();
    return (
      <>
        <DetailHeader title={`Capacity breakdown by ${perPerson ? 'person' : org_.d}`} lede={`Ideal − absence − shortfall + extra = achieved, on ${label} time against the ${benchmark}h benchmark, for ${teamLabel}.`}>{controls}</DetailHeader>
        <div className="grid">
          <div className="span-12"><CapacityKpis b={org} benchmark={benchmark} workingDays={wd} metricLabel={label} status={status} /></div>
          <Section title="Capacity lens"><CapacityLensView b={org} benchmark={benchmark} workingDays={wd} headcount={headcount} status={status} /></Section>
          <Section title={`All ${byGroup.length} ${perPerson ? 'people' : org_.ds}`} note="Sorted by deviation as a share of ideal, most below first. Deviation = achieved − ideal = −absence − shortfall + extra.">
            <DataTable rows={byGroup} initialSort={{ key: 'devPct', dir: 'asc' }} onRowClick={(r) => drill(r.name, 'breakdown')} rowTitle={rowTitle} cols={[
              { key: 'name', label: GroupNoun, get: (r) => r.name },
              ...(perPerson ? [] : [{ key: 'people', label: 'People', align: 'right' as const, get: (r: CapacityBreakdown) => r.people }]),
              { key: 'ideal', label: 'Ideal h', align: 'right', get: (r) => r.ideal, render: (r) => fmtN(r.ideal) },
              { key: 'absence', label: 'Absence h', align: 'right', get: (r) => r.absence, render: (r) => fmtN(r.absence) },
              ...reasonKeys.map((k) => ({ key: `r-${k}`, label: `· ${k}`, align: 'right' as const, get: (r: CapacityBreakdown) => r.absenceByReason[k] ?? 0, render: (r: CapacityBreakdown) => <span className="muted">{fmtN(r.absenceByReason[k] ?? 0)}</span> })),
              { key: 'shortfall', label: 'Shortfall h', align: 'right', get: (r) => r.shortfall, render: (r) => fmtN(r.shortfall) },
              { key: 'extra', label: 'Extra h', align: 'right', get: (r) => r.extra, render: (r) => fmtN(r.extra) },
              { key: 'achieved', label: 'Achieved h', align: 'right', get: (r) => r.achieved, render: (r) => fmtN(r.achieved) },
              { key: 'dev', label: 'Deviation h', align: 'right', get: (r) => r.deviation, render: (r) => <b className={r.deviation < 0 ? 'neg' : 'pos'}>{r.deviation >= 0 ? '+' : '−'}{fmtN(Math.abs(r.deviation))}</b> },
              { key: 'devFte', label: '≈ people', align: 'right', get: (r) => fte(r.deviation), render: (r) => <span className={r.deviation < 0 ? 'neg' : 'pos'}>{r.deviation >= 0 ? '+' : '−'}{fmtFte(Math.abs(fte(r.deviation)))}</span> },
              { key: 'devPct', label: 'Deviation %', align: 'right', get: (r) => r.deviation / Math.max(1, r.ideal), render: (r) => fmtPct((r.deviation / Math.max(1, r.ideal)) * 100, 1) },
            ]} />
          </Section>
        </div>
      </>
    );
  }

  /* ------------------------------ department detail ------------------------------ */
  if (detail === 'depts') return (
    <>
      <DetailHeader title={perPerson ? `${team}: capacity by person` : `Capacity by ${org_.d}`} lede={`Average ${label} hours per present day against the ${benchmark}h benchmark (±${variance}%), for ${teamLabel}.`}>{controls}</DetailHeader>
      <div className="grid">
        <Section title={perPerson ? 'People against the healthy band' : `${org_.Ds} against the healthy band`}>{legend}{deptChart(Math.max(280, depts.length * 28 + 60))}</Section>
        <Section title={`All ${depts.length} ${perPerson ? 'people' : org_.ds}`} note={`Ideal capacity = headcount × ${wd} working days × ${benchmark}h. People are classed on their own average ${label} hours per present day.`}>
          <DataTable rows={depts} initialSort={{ key: 'v', dir: 'asc' }} onRowClick={(r) => drill(r.name, 'depts')} rowTitle={rowTitle} rowClass={(r) => (r.status === 'under' ? 'row-bad' : r.status === 'over' ? 'row-warn' : '')} cols={[
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
        {org && (
          <div className="span-12">
            <CapacityKpis b={org} benchmark={benchmark} workingDays={wd} metricLabel={label} status={status} />
          </div>
        )}

        {org && (
          <Section id="lens" title="Capacity lens" tools={controls} onOpen={() => openDetail('breakdown', 'lens')}
            note={`Net hours for the period, the people they equal at the ${benchmark}h benchmark, and where the gap comes from. Directional, not a staffing recommendation.`}>
            <CapacityLensView b={org} benchmark={benchmark} workingDays={wd} headcount={headcount} status={status} />
            <div className="status-split">
              <span className="presence-title">{fmtN(counted.length)} people by their average {label} hours per present day</span>
              <div className="status-bar" role="img" aria-label={`${split.under} underutilised, ${split.healthy} healthy, ${split.over} overburdened`}>
                {(['under', 'healthy', 'over'] as Status[]).map((st) => split[st] > 0 && (
                  <i key={st} style={{ width: `${(split[st] / totalPeople) * 100}%`, background: STATUS_COLOR[st] }} />
                ))}
              </div>
              <div className="status-legend">
                <span><b style={{ color: STATUS_COLOR.under }}>{fmtN(split.under)}</b> underutilised · below {min}h</span>
                <span><b style={{ color: STATUS_COLOR.healthy }}>{fmtN(split.healthy)}</b> healthy · {min}–{max}h</span>
                <span><b style={{ color: STATUS_COLOR.over }}>{fmtN(split.over)}</b> overburdened · above {max}h</span>
              </div>
            </div>
          </Section>
        )}

        <Section id="depts" title={perPerson ? `${team} at a glance` : `${org_.Ds} at a glance`} onOpen={() => openDetail('depts', 'depts')}
          note={`Each dot is a ${perPerson ? 'person' : org_.d}, placed by how loaded it is against the ${benchmark}h ${label} time benchmark. Hover a dot for details${teamClicks ? '; click to see its people' : ''}.`}>
          <TeamsGlance items={depts.map((d) => ({ name: d.name, value: d.value, status: d.status, people: perPerson ? undefined : d.people }))}
            min={min} max={max} benchmark={benchmark} variancePct={variance} unit={label} noun={perPerson ? 'person' : org_.d}
            pickable={teamClicks} onPick={(n) => drill(n, 'depts')} />
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
