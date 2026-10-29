/* =====================================================================
 * METRIC ENGINE - every number on screen is computed here from raw rows.
 * Pages never hard-code client values.
 * ===================================================================== */
import type {
  AppUsageRecord, CapacityConfig, CohortDef, CohortMeasure, CohortRule, Comparator, DailyRecord, Dataset, Employee, MetricKey,
  PeriodKey, PersonMeasure, RedFlagConfig, Threshold,
} from '../types';

export const H = (sec: number) => sec / 3600;
export const METRIC_LABEL: Record<MetricKey, string> = { active: 'Active', productive: 'Productive', online: 'Online' };
export const PERIOD_LABEL: Record<PeriodKey, string> = { '1m': 'Last 1 month', '3m': 'Last 3 months', '6m': 'Last 6 months', '1y': 'Last 1 year' };
const PERIOD_MONTHS: Record<PeriodKey, number> = { '1m': 1, '3m': 3, '6m': 6, '1y': 12 };

export const compare = (a: number, op: Comparator, b: number) =>
  op === '<' ? a < b : op === '<=' ? a <= b : op === '>' ? a > b : a >= b;

export const thresholdText = (t: Threshold) => `${METRIC_LABEL[t.metric].toLowerCase()} ${t.op} ${t.value}h/day`;

/* ------------------------------ period ------------------------------ */
export interface Range { start: string; end: string; dataStart: string; clipped: boolean; workingDays: number }

export function periodRange(ds: Dataset, period: PeriodKey): Range {
  let min = '9999', max = '0000';
  for (const d of ds.daily) { if (d.date < min) min = d.date; if (d.date > max) max = d.date; }
  // start = (day after end) - N months, so 30 Sep with 6 months gives 1 Apr (not 31 Mar)
  const s = new Date(max + 'T00:00:00Z');
  s.setUTCDate(s.getUTCDate() + 1);
  s.setUTCMonth(s.getUTCMonth() - PERIOD_MONTHS[period]);
  const start = s.toISOString().slice(0, 10);
  const clipped = start < min;
  const realStart = clipped ? min : start;
  const wd = new Set(ds.daily.filter((d) => d.date >= realStart && d.date <= max).map((d) => d.date)).size;
  return { start: realStart, end: max, dataStart: min, clipped, workingDays: wd };
}

/* ------------------------------ scope ------------------------------ */
export interface Scope {
  ds: Dataset;
  range: Range;
  employees: Employee[];
  empById: Map<string, Employee>;
  daily: DailyRecord[];
  usage: AppUsageRecord[];
  aiToolOf: (name: string) => string | null;
}

export function makeScope(ds: Dataset, period: PeriodKey): Scope {
  const range = periodRange(ds, period);
  const employees = ds.employees.filter((e) => !e.excluded);
  const empById = new Map(employees.map((e) => [e.id, e]));
  const daily = ds.daily.filter((d) => d.date >= range.start && d.date <= range.end && empById.has(d.employeeId));
  const sm = range.start.slice(0, 7), em = range.end.slice(0, 7);
  const usage = ds.appUsage.filter((u) => { const m = u.date.slice(0, 7); return m >= sm && m <= em && empById.has(u.employeeId); });
  const matchers = Object.entries(ds.config.aiTools).flatMap(([tool, pats]) => pats.map((p) => [p.toLowerCase(), tool] as const));
  const cache = new Map<string, string | null>();
  const aiToolOf = (name: string) => {
    if (cache.has(name)) return cache.get(name)!;
    const n = name.toLowerCase();
    const hit = matchers.find(([p]) => n.includes(p))?.[1] ?? null;
    cache.set(name, hit);
    return hit;
  };
  return { ds, range, employees, empById, daily, usage, aiToolOf };
}

/** Narrow a scope to a subset of people (e.g. one team). */
export function filterScope(sc: Scope, keep: (e: Employee) => boolean): Scope {
  const employees = sc.employees.filter(keep);
  const ids = new Set(employees.map((e) => e.id));
  return {
    ...sc, employees, empById: new Map(employees.map((e) => [e.id, e])),
    daily: sc.daily.filter((d) => ids.has(d.employeeId)), usage: sc.usage.filter((u) => ids.has(u.employeeId)),
  };
}

/* --------------------------- person stats --------------------------- */
export interface MonthSums { present: number; online: number; active: number; productive: number }
export interface PersonStat {
  emp: Employee;
  trackedDays: number;
  presentDays: number;
  avg: Record<MetricKey, number>;      // hrs per present day
  sum: { online: number; active: number; productive: number; neutral: number; unproductive: number }; // seconds
  productivePct: number;
  daysByMetric: Record<MetricKey, number[]>; // per present day hours (for "% days under")
  months: Record<string, MonthSums>;
  unproductiveHrs: number;              // from app usage
  topUnproductive: string | null;
  nonWorkHrs: number;
  /** non-work hours per screened category */
  nonWorkByCat: Record<string, number>;
  /** hours per usage category (all categories) */
  catHrs: Record<string, number>;
  /** unproductive hours per app / url */
  unprodItems: Record<string, number>;
  aiHrs: number;
  aiTools: Set<string>;
}

export function personStats(sc: Scope): PersonStat[] {
  const map = new Map<string, PersonStat>();
  const get = (id: string) => {
    let p = map.get(id);
    if (!p) {
      p = {
        emp: sc.empById.get(id)!, trackedDays: 0, presentDays: 0, avg: { active: 0, productive: 0, online: 0 },
        sum: { online: 0, active: 0, productive: 0, neutral: 0, unproductive: 0 }, productivePct: 0,
        daysByMetric: { active: [], productive: [], online: [] }, months: {}, unproductiveHrs: 0,
        topUnproductive: null, nonWorkHrs: 0, nonWorkByCat: {}, catHrs: {}, unprodItems: {}, aiHrs: 0, aiTools: new Set(),
      };
      map.set(id, p);
    }
    return p;
  };
  for (const d of sc.daily) {
    const p = get(d.employeeId);
    p.trackedDays++;
    if (!d.present) continue;
    p.presentDays++;
    p.sum.online += d.onlineSec; p.sum.active += d.activeSec; p.sum.productive += d.productiveSec;
    p.sum.neutral += d.neutralSec; p.sum.unproductive += d.unproductiveSec;
    p.daysByMetric.active.push(H(d.activeSec)); p.daysByMetric.productive.push(H(d.productiveSec)); p.daysByMetric.online.push(H(d.onlineSec));
    const m = d.date.slice(0, 7);
    const ms = (p.months[m] ??= { present: 0, online: 0, active: 0, productive: 0 });
    ms.present++; ms.online += d.onlineSec; ms.active += d.activeSec; ms.productive += d.productiveSec;
  }
  const nonWork = new Set(sc.ds.config.nonWorkCategories);
  const unprodBy = new Map<string, Map<string, number>>();
  for (const u of sc.usage) {
    const p = get(u.employeeId);
    const tool = sc.aiToolOf(u.name);
    p.catHrs[u.category] = (p.catHrs[u.category] ?? 0) + H(u.activeSec);
    if (tool) { p.aiHrs += H(u.activeSec); p.aiTools.add(tool); }
    if (nonWork.has(u.category)) { p.nonWorkHrs += H(u.activeSec); p.nonWorkByCat[u.category] = (p.nonWorkByCat[u.category] ?? 0) + H(u.activeSec); }
    if (u.productivity === 'unproductive') {
      p.unproductiveHrs += H(u.activeSec);
      p.unprodItems[u.name] = (p.unprodItems[u.name] ?? 0) + H(u.activeSec);
      const m = unprodBy.get(u.employeeId) ?? new Map<string, number>();
      m.set(u.name, (m.get(u.name) ?? 0) + u.activeSec);
      unprodBy.set(u.employeeId, m);
    }
  }
  for (const p of map.values()) {
    const n = p.presentDays || 1;
    p.avg = { active: H(p.sum.active) / n, productive: H(p.sum.productive) / n, online: H(p.sum.online) / n };
    p.productivePct = p.sum.active ? (p.sum.productive / p.sum.active) * 100 : 0;
    const m = unprodBy.get(p.emp.id);
    if (m) p.topUnproductive = [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }
  return [...map.values()].filter((p) => p.emp);
}

export const pctDaysMeeting = (p: PersonStat, t: Threshold) => {
  const arr = p.daysByMetric[t.metric];
  return arr.length ? (arr.filter((h) => compare(h, t.op, t.value)).length / arr.length) * 100 : 0;
};

export function measureOf(p: PersonStat, m: PersonMeasure, t?: Threshold): number {
  switch (m) {
    case 'avgActive': return p.avg.active;
    case 'avgProductive': return p.avg.productive;
    case 'avgOnline': return p.avg.online;
    case 'productivePct': return p.productivePct;
    case 'unproductiveHrs': return p.unproductiveHrs;
    case 'nonWorkHrs': return p.nonWorkHrs;
    case 'aiHrs': return p.aiHrs;
    case 'pctDaysUnder': return t ? pctDaysMeeting(p, t) : 0;
    case 'presentDays': return p.presentDays;
  }
}
export const MEASURE_SHORT: Record<PersonMeasure, string> = {
  avgActive: 'Active/day', avgProductive: 'Productive/day', avgOnline: 'Online/day', productivePct: 'Productive share',
  unproductiveHrs: 'Unproductive', nonWorkHrs: 'Non-work', aiHrs: 'AI time', pctDaysUnder: 'Days meeting', presentDays: 'Present days',
};
export const MEASURE_LABEL: Record<PersonMeasure, { label: string; unit: string }> = {
  avgActive: { label: 'Avg. active hrs/day', unit: 'h' },
  avgProductive: { label: 'Avg. productive hrs/day', unit: 'h' },
  avgOnline: { label: 'Avg. online hrs/day', unit: 'h' },
  productivePct: { label: 'Productive share of active time', unit: '%' },
  unproductiveHrs: { label: 'Unproductive hours (total)', unit: 'h' },
  nonWorkHrs: { label: 'Non-work hours (total)', unit: 'h' },
  aiHrs: { label: 'AI tool hours (total)', unit: 'h' },
  pctDaysUnder: { label: '% of days meeting list threshold', unit: '%' },
  presentDays: { label: 'Present days', unit: 'd' },
};

/* ------------------------------ coverage ------------------------------ */
export function coverage(sc: Scope) {
  const total = sc.daily.length;
  let present = 0;
  const byReason: Record<string, number> = {};
  for (const d of sc.daily) {
    if (d.present) present++;
    else { const k = d.absenceReason || 'No presence signal'; byReason[k] = (byReason[k] ?? 0) + 1; }
  }
  return { total, present, missing: total - present, pct: total ? (present / total) * 100 : 0, byReason };
}

/* ------------------------------ org avg ------------------------------ */
export function orgAvg(stats: PersonStat[]): Record<MetricKey, number> {
  let n = 0, a = 0, p = 0, o = 0;
  for (const s of stats) { n += s.presentDays; a += s.sum.active; p += s.sum.productive; o += s.sum.online; }
  n ||= 1;
  return { active: H(a) / n, productive: H(p) / n, online: H(o) / n };
}

/* ------------------------------ groups ------------------------------ */
export interface GroupStat {
  name: string; people: number; avg: Record<MetricKey, number>;
  prodPct: number; neutralPct: number; unprodPct: number;
  meeting: number; meetingPct: number;
}
/** Group rows by department, team, or person (one row per person - used when a single team is selected). */
export type GroupKey = 'department' | 'team' | 'person';
export function groupStats(stats: PersonStat[], key: GroupKey, t: Threshold, minSize: number, minDays = 1): GroupStat[] {
  const g = new Map<string, PersonStat[]>();
  stats.filter((s) => s.presentDays >= minDays).forEach((s) => {
    const k = key === 'person' ? s.emp.name : s.emp[key];
    g.set(k, [...(g.get(k) ?? []), s]);
  });
  const out: GroupStat[] = [];
  for (const [name, list] of g) {
    if (key !== 'person' && list.length < minSize) continue;
    let n = 0; const sum = { online: 0, active: 0, productive: 0, neutral: 0, unproductive: 0 };
    list.forEach((s) => { n += s.presentDays; (Object.keys(sum) as (keyof typeof sum)[]).forEach((k) => (sum[k] += s.sum[k])); });
    n ||= 1;
    const cls = sum.productive + sum.neutral + sum.unproductive || 1;
    const meeting = list.filter((s) => compare(s.avg[t.metric], t.op, t.value)).length;
    out.push({
      name, people: list.length,
      avg: { active: H(sum.active) / n, productive: H(sum.productive) / n, online: H(sum.online) / n },
      prodPct: (sum.productive / cls) * 100, neutralPct: (sum.neutral / cls) * 100, unprodPct: (sum.unproductive / cls) * 100,
      meeting, meetingPct: (meeting / list.length) * 100,
    });
  }
  return out;
}

/* ------------------------------ months ------------------------------ */
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function monthLabel(m: string, partial: boolean) { return MON[Number(m.slice(5, 7)) - 1] + (partial ? '*' : ''); }

/** Months in range, with partial flag when the range does not cover the whole month. */
export function monthsIn(sc: Scope) {
  const ms = Array.from(new Set(sc.daily.map((d) => d.date.slice(0, 7)))).sort();
  return ms.map((m) => {
    const first = new Date(m + '-01T00:00:00Z');
    const last = new Date(first); last.setUTCMonth(last.getUTCMonth() + 1); last.setUTCDate(0);
    const fd = first.toISOString().slice(0, 10), ld = last.toISOString().slice(0, 10);
    // partial if the range starts after the first weekday or ends before the last weekday
    const fw = new Date(first); while ([0, 6].includes(fw.getUTCDay())) fw.setUTCDate(fw.getUTCDate() + 1);
    const lw = new Date(last); while ([0, 6].includes(lw.getUTCDay())) lw.setUTCDate(lw.getUTCDate() - 1);
    const partial = sc.range.start > fw.toISOString().slice(0, 10) || sc.range.end < lw.toISOString().slice(0, 10);
    return { key: m, partial, label: monthLabel(m, partial), fd, ld };
  });
}

/** Trend buckets: weekly when the period is short (<= 31 working days), monthly otherwise. */
export function monthlyTrend(sc: Scope, _stats?: PersonStat[]) {
  const weekly = sc.range.workingDays <= 31;
  const parts = new Map(monthsIn(sc).map((m) => [m.key, m]));
  const key = (iso: string) => {
    if (!weekly) return iso.slice(0, 7);
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  };
  const agg = new Map<string, { n: number; a: number; p: number; o: number }>();
  for (const d of sc.daily) {
    if (!d.present) continue;
    const k = key(d.date);
    const x = agg.get(k) ?? { n: 0, a: 0, p: 0, o: 0 };
    x.n++; x.a += d.activeSec; x.p += d.productiveSec; x.o += d.onlineSec;
    agg.set(k, x);
  }
  return [...agg.keys()].sort().map((k) => {
    const x = agg.get(k)!;
    const partial = weekly ? false : parts.get(k)?.partial ?? false;
    const label = weekly ? `w/c ${Number(k.slice(8, 10))} ${MON[Number(k.slice(5, 7)) - 1]}` : monthLabel(k, partial);
    return { month: label, partial, weekly, online: +(H(x.o) / x.n).toFixed(2), active: +(H(x.a) / x.n).toFixed(2), productive: +(H(x.p) / x.n).toFixed(2) };
  });
}

/* ------------------------------ cohorts ------------------------------ */
export type CohortBy = 'band' | 'ai' | 'department' | 'join';
type Bands = { metric: MetricKey; low: number; high: number };
/** Hour-range label for a value, e.g. "Under 3h", "3–6h", "Over 6h". */
export const bandOf = (v: number, b: Bands) => (v < b.low ? `Under ${b.low}h` : v > b.high ? `Over ${b.high}h` : `${b.low}–${b.high}h`);
export const bandOrder = (b: Bands) => [`Under ${b.low}h`, `${b.low}–${b.high}h`, `Over ${b.high}h`];

export function cohortOf(by: CohortBy, s: PersonStat, bands: Bands, powerCut: number): string {
  switch (by) {
    case 'band': return bandOf(s.avg[bands.metric], bands);
    case 'ai': return s.aiHrs === 0 ? 'No AI use' : s.aiHrs >= powerCut ? 'AI power users' : 'Light AI users';
    case 'department': return s.emp.department;
    case 'join': return s.emp.joinDate ? `Joined ${monthLabel(s.emp.joinDate.slice(0, 7), false)} ${s.emp.joinDate.slice(0, 4)}` : 'Join date unknown';
  }
}
export function cohortTable(sc: Scope, stats: PersonStat[], by: CohortBy, metric: MetricKey, bands: { metric: MetricKey; low: number; high: number }, powerCut: number) {
  const months = monthsIn(sc);
  const groups = new Map<string, PersonStat[]>();
  stats.forEach((s) => { const k = cohortOf(by, s, bands, powerCut); groups.set(k, [...(groups.get(k) ?? []), s]); });
  const rows = [...groups.entries()].map(([name, list]) => {
    const all = orgAvg(list);
    const series = months.map((m) => {
      let n = 0, v = 0;
      list.forEach((s) => { const x = s.months[m.key]; if (x) { n += x.present; v += metric === 'active' ? x.active : metric === 'productive' ? x.productive : x.online; } });
      return n ? +(H(v) / n).toFixed(2) : null;
    });
    const ai = list.filter((s) => s.aiHrs > 0).length;
    return { name, people: list.length, avg: all[metric], series, aiPct: (ai / list.length) * 100, prodPct: list.reduce((a, s) => a + s.productivePct, 0) / list.length };
  });
  rows.sort((a, b) => b.people - a.people);
  return { months, rows };
}

/**
 * People per group per month (bar chart). For activity bands each person is placed in the
 * hour range of THAT month's average, so the bars show how many people sit in each range
 * month by month. Other groupings count the group's people who were present that month.
 */
export function cohortCounts(sc: Scope, stats: PersonStat[], by: CohortBy, bands: Bands, powerCut: number, groups: string[]) {
  const months = monthsIn(sc);
  return months.map((m) => {
    const row: Record<string, string | number> = { month: m.label };
    groups.forEach((g) => (row[g] = 0));
    stats.forEach((s) => {
      const x = s.months[m.key];
      if (!x || !x.present) return;
      const g = by === 'band' ? bandOf(x[bands.metric] / 3600 / x.present, bands) : cohortOf(by, s, bands, powerCut);
      if (g in row) row[g] = (row[g] as number) + 1;
    });
    return row;
  });
}

/* ------------------------------ time & capacity ------------------------------ */
/** Healthy capacity band: explicit min / max when configured, else benchmark ± variance. */
export function capacityBand(cap: CapacityConfig) {
  const min = cap.min ?? +(cap.benchmark * (1 - cap.variancePct / 100)).toFixed(2);
  const max = cap.max ?? +(cap.benchmark * (1 + cap.variancePct / 100)).toFixed(2);
  return { min, max, status: (v: number): 'under' | 'healthy' | 'over' => (v < min ? 'under' : v > max ? 'over' : 'healthy') };
}

/**
 * Capacity breakdown (sheet: Org_Summary / Team_Monthly / Capacity_Employee):
 *   Ideal    = benchmark x person-days in the period (headcount x working days)
 *   Absence  = benchmark x days with no presence
 *   Shortfall= sum over present days of max(0, benchmark - metric)
 *   Extra    = sum over present days of max(0, metric - benchmark)
 *   Achieved = sum of the metric on present days = Ideal - Absence - Shortfall + Extra
 *   Deviation= Achieved - Ideal (negative = work not done)
 */
export interface CapacityBreakdown {
  name: string; people: number; ideal: number; absence: number; shortfall: number; extra: number; achieved: number; deviation: number;
  absenceByReason: Record<string, number>;
}
export function capacityBreakdown(sc: Scope, cap: CapacityConfig, key: GroupKey | null = null): CapacityBreakdown[] {
  const b = cap.benchmark;
  const field = cap.metric === 'online' ? 'onlineSec' : cap.metric === 'active' ? 'activeSec' : 'productiveSec';
  const groups = new Map<string, CapacityBreakdown & { ids: Set<string> }>();
  for (const d of sc.daily) {
    const e = sc.empById.get(d.employeeId); if (!e) continue;
    const k = key === 'person' ? e.name : key ? e[key] : 'All';
    const g = groups.get(k) ?? { name: k, people: 0, ideal: 0, absence: 0, shortfall: 0, extra: 0, achieved: 0, deviation: 0, absenceByReason: {}, ids: new Set<string>() };
    g.ids.add(d.employeeId);
    g.ideal += b;
    if (d.present) {
      const v = H(d[field]);
      g.achieved += v;
      g.shortfall += Math.max(0, b - v);
      g.extra += Math.max(0, v - b);
    } else {
      g.absence += b;
      const reason = d.absenceReason || 'No presence signal';
      g.absenceByReason[reason] = (g.absenceByReason[reason] ?? 0) + b;
    }
    groups.set(k, g);
  }
  return [...groups.values()].map(({ ids, ...g }) => ({ ...g, people: ids.size, deviation: g.achieved - g.ideal }));
}
export interface CapacityRow {
  name: string; people: number; presentDays: number;
  /** average hours per present day */
  span: number; online: number; active: number; productive: number;
  /** headcount needed if everyone worked `dayHours` a day, on each basis */
  fteActive: number; fteSpan: number;
  utilisation: number; // active / span, %
}
/**
 * Capacity lens (deck slide 17): total recorded hours divided by a standard day x working days.
 * Active basis = smallest team that could do the screen work; span basis = largest team the
 * punch-in-to-out time could need. Span falls back to online time when the ledger has no span.
 */
export function capacity(sc: Scope, dayHours: number, key: GroupKey | null = null): CapacityRow[] {
  const wd = Math.max(1, sc.range.workingDays);
  const groups = new Map<string, { ids: Set<string>; n: number; span: number; online: number; active: number; productive: number }>();
  for (const d of sc.daily) {
    if (!d.present) continue;
    const e = sc.empById.get(d.employeeId); if (!e) continue;
    const k = key === 'person' ? e.name : key ? e[key] : 'All';
    const g = groups.get(k) ?? { ids: new Set<string>(), n: 0, span: 0, online: 0, active: 0, productive: 0 };
    g.ids.add(d.employeeId); g.n++;
    g.span += d.spanSec ?? d.onlineSec; g.online += d.onlineSec; g.active += d.activeSec; g.productive += d.productiveSec;
    groups.set(k, g);
  }
  return [...groups.entries()].map(([name, g]) => {
    const n = g.n || 1;
    return {
      name, people: g.ids.size, presentDays: g.n,
      span: H(g.span) / n, online: H(g.online) / n, active: H(g.active) / n, productive: H(g.productive) / n,
      fteActive: H(g.active) / (dayHours * wd), fteSpan: H(g.span) / (dayHours * wd),
      utilisation: g.span ? (g.active / g.span) * 100 : 0,
    };
  });
}

/* ------------------------------ custom cohorts ------------------------------ */
export const COHORT_MEASURES: { value: CohortMeasure; label: string; unit: string }[] = [
  { value: 'active', label: 'Active time / day', unit: 'h' },
  { value: 'productive', label: 'Productive time / day', unit: 'h' },
  { value: 'online', label: 'Online time / day', unit: 'h' },
  { value: 'idle', label: 'Idle time / day', unit: 'h' },
  { value: 'category', label: 'Category usage (period)', unit: 'h' },
  { value: 'unproductiveHrs', label: 'All unproductive usage (period)', unit: 'h' },
  { value: 'nonWorkHrs', label: 'All non-work usage (period)', unit: 'h' },
  { value: 'aiHrs', label: 'AI tool usage (period)', unit: 'h' },
  { value: 'productivePct', label: 'Productive share of active', unit: '%' },
  { value: 'presentDays', label: 'Present days', unit: 'd' },
];
export const cohortMeasureLabel = (m: CohortMeasure) => COHORT_MEASURES.find((x) => x.value === m)!;

export function cohortValue(p: PersonStat, r: CohortRule): number {
  switch (r.measure) {
    case 'active': case 'productive': case 'online': return p.avg[r.measure];
    case 'idle': return Math.max(0, p.avg.online - p.avg.active);
    case 'category': return r.category ? p.catHrs[r.category] ?? 0 : 0;
    case 'unproductiveHrs': return p.unproductiveHrs;
    case 'nonWorkHrs': return p.nonWorkHrs;
    case 'aiHrs': return p.aiHrs;
    case 'productivePct': return p.productivePct;
    case 'presentDays': return p.presentDays;
  }
}
export function ruleMatches(p: PersonStat, r: CohortRule): boolean {
  const v = cohortValue(p, r);
  if (r.mode === 'min') return v >= (r.min ?? 0);
  if (r.mode === 'max') return v <= (r.max ?? Infinity);
  return v >= (r.min ?? -Infinity) && v <= (r.max ?? Infinity);
}
export function cohortMembers(stats: PersonStat[], c: CohortDef): PersonStat[] {
  if (!c.rules.length) return [];
  return stats.filter((p) => (c.combine === 'all' ? c.rules.every((r) => ruleMatches(p, r)) : c.rules.some((r) => ruleMatches(p, r))));
}
export function ruleText(r: CohortRule): string {
  const m = cohortMeasureLabel(r.measure);
  const what = r.measure === 'category' ? `${r.category ?? 'category'} usage` : m.label.replace(' (period)', '').toLowerCase();
  const u = m.unit;
  if (r.mode === 'min') return `${what} ≥ ${r.min ?? 0}${u}`;
  if (r.mode === 'max') return `${what} ≤ ${r.max ?? 0}${u}`;
  return `${what} ${r.min ?? 0}–${r.max ?? 0}${u}`;
}
export const cohortText = (c: CohortDef) => c.rules.map(ruleText).join(c.combine === 'all' ? ' and ' : ' or ') || 'no rules yet';

/* ------------------------------ apps & urls ------------------------------ */
export function topItems(sc: Scope, opts: { kind?: 'app' | 'url'; productivity?: string; exclude?: string[]; n: number; categories?: string[] }) {
  const agg = new Map<string, { name: string; sec: number; people: Set<string>; productivity: string; category: string; kind: string }>();
  for (const u of sc.usage) {
    if (opts.kind && u.kind !== opts.kind) continue;
    if (opts.productivity && u.productivity !== opts.productivity) continue;
    if (opts.exclude?.includes(u.name)) continue;
    if (opts.categories && !opts.categories.includes(u.category)) continue;
    const a = agg.get(u.name) ?? { name: u.name, sec: 0, people: new Set<string>(), productivity: u.productivity, category: u.category, kind: u.kind };
    a.sec += u.activeSec; a.people.add(u.employeeId);
    agg.set(u.name, a);
  }
  return [...agg.values()].sort((a, b) => b.sec - a.sec).slice(0, opts.n)
    .map((a) => ({ name: a.name, hours: H(a.sec), people: a.people.size, productivity: a.productivity, category: a.category, kind: a.kind }));
}

export function usageTotals(sc: Scope) {
  const t = { total: 0, productive: 0, neutral: 0, unproductive: 0 };
  sc.usage.forEach((u) => { t.total += u.activeSec; t[u.productivity] += u.activeSec; });
  return { total: H(t.total), productive: H(t.productive), neutral: H(t.neutral), unproductive: H(t.unproductive) };
}

export function nonWork(sc: Scope, stats: PersonStat[], heavyCut: number) {
  const cats = sc.ds.config.nonWorkCategories;
  const byCat = new Map<string, { hours: number; people: Set<string> }>(cats.map((c) => [c, { hours: 0, people: new Set() }]));
  for (const u of sc.usage) {
    const c = byCat.get(u.category);
    if (c) { c.hours += H(u.activeSec); c.people.add(u.employeeId); }
  }
  const total = [...byCat.values()].reduce((a, c) => a + c.hours, 0);
  const touched = stats.filter((s) => s.nonWorkHrs > 0).sort((a, b) => b.nonWorkHrs - a.nonWorkHrs);
  const top3 = touched.slice(0, 3).reduce((a, s) => a + s.nonWorkHrs, 0);
  const all = usageTotals(sc).total;
  return {
    categories: cats.map((c) => ({ category: c, hours: byCat.get(c)!.hours, people: byCat.get(c)!.people.size })),
    total, sharePct: all ? (total / all) * 100 : 0, touched: touched.length, heavy: touched.filter((s) => s.nonWorkHrs > heavyCut).length,
    top3Pct: total ? (top3 / total) * 100 : 0, people: touched,
  };
}

/* ------------------------------ AI ------------------------------ */
export function aiAdoption(sc: Scope, stats: PersonStat[]) {
  const hub = sc.ds.config.aiHubTool;
  const adopters = stats.filter((s) => s.aiHrs > 0);
  const nonHub = stats.filter((s) => [...s.aiTools].some((t) => t !== hub));
  const byTool = new Map<string, number>();
  adopters.forEach((s) => s.aiTools.forEach((t) => byTool.set(t, (byTool.get(t) ?? 0) + 1)));
  const toolHrs = new Map<string, number>();
  sc.usage.forEach((u) => { const t = sc.aiToolOf(u.name); if (t) toolHrs.set(t, (toolHrs.get(t) ?? 0) + H(u.activeSec)); });
  const totalHrs = adopters.reduce((a, s) => a + s.aiHrs, 0);
  const months = monthsIn(sc);
  const monthly = months.map((m) => ({ month: m.label, partial: m.partial, hours: 0, users: new Set<string>() }));
  const idx = new Map(months.map((m, i) => [m.key, i]));
  sc.usage.forEach((u) => {
    if (!sc.aiToolOf(u.name)) return;
    const i = idx.get(u.date.slice(0, 7)); if (i === undefined) return;
    monthly[i].hours += H(u.activeSec); monthly[i].users.add(u.employeeId);
  });
  const nMonths = Math.max(1, sc.range.workingDays / 21.5);
  return {
    people: stats.length, adopters: adopters.length, adoptionPct: stats.length ? (adopters.length / stats.length) * 100 : 0,
    nonHubPct: stats.length ? (nonHub.length / stats.length) * 100 : 0,
    byTool: [...byTool.entries()].map(([tool, users]) => ({ tool, users, hours: +(toolHrs.get(tool) ?? 0).toFixed(1) })).sort((a, b) => b.users - a.users),
    totalHrs, perUserPerMonth: adopters.length ? totalHrs / adopters.length / nMonths : 0,
    monthly: monthly.map((m) => ({ month: m.month, partial: m.partial, hours: +m.hours.toFixed(1), users: m.users.size })),
  };
}

/* ------------------------------ red flags ------------------------------ */
export function redFlags(stats: PersonStat[], cfg: RedFlagConfig, t: Threshold) {
  const rules = cfg.rules.filter((r) => r.enabled);
  if (!rules.length) return [];
  return stats.filter((s) => {
    if (s.presentDays < cfg.minPresentDays) return false;
    const hits = rules.map((r) => compare(measureOf(s, r.measure, t), r.op, r.value));
    return cfg.combine === 'all' ? hits.every(Boolean) : hits.some(Boolean);
  }).map((s) => ({ s, reasons: rules.filter((r) => compare(measureOf(s, r.measure, t), r.op, r.value)).map((r) => r.measure) }));
}

/* ------------------------------ formatting ------------------------------ */
export const fmtH = (h: number, d = 1) => `${h.toFixed(d)}h`;
export const fmtN = (n: number) => Math.round(n).toLocaleString('en-US');
export const fmtPct = (p: number, d = 0) => `${p.toFixed(d)}%`;
export const fmtDate = (iso: string) => {
  const d = new Date(iso + 'T00:00:00Z');
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
