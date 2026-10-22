/* =====================================================================
 * DECISION RULES - "Act now", "Opportunity", "Keep as is".
 * ---------------------------------------------------------------------
 * Each rule has a condition on the data; it only appears when the
 * condition holds. Thresholds come from ClientConfig.defaults.insightRules
 * and the capacity benchmark, so every client can tune them.
 * `pages` decides where a rule is shown; Overview shows only 'priority'.
 * ===================================================================== */
import type { CapacityConfig, Dataset, Insight } from '../types';
import { fmtDate, fmtH, fmtN, fmtPct, H, topItems, usageTotals, type PersonStat, type Scope } from './metrics';

const plural = (n: number, one: string, many = `${one}s`) => `${fmtN(n)} ${n === 1 ? one : many}`;
const listJoin = (xs: string[], word: string) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ${word} ${xs[xs.length - 1]}`);
/** "Product Development (14), TCoE (11), Product and Innovation (8)" */
function topGroups(list: PersonStat[], n = 3) {
  const m = new Map<string, number>();
  list.forEach((p) => m.set(p.emp.department, (m.get(p.emp.department) ?? 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([d, c]) => `${d} (${c})`).join(', ');
}

/** Last two complete months for the people in scope, up to the end of the selected period. */
function monthOverMonth(ds: Dataset, sc: Scope) {
  const end = sc.range.end;
  const rows = ds.daily.filter((d) => d.date <= end && sc.empById.has(d.employeeId));
  if (!rows.length) return null;
  const dataStart = rows.reduce((m, d) => (d.date < m ? d.date : m), end);
  const by = new Map<string, { t: number; p: number; online: number; active: number }>();
  rows.forEach((d) => {
    const k = d.date.slice(0, 7);
    const x = by.get(k) ?? { t: 0, p: 0, online: 0, active: 0 };
    x.t++; if (d.present) { x.p++; x.online += d.onlineSec; x.active += d.activeSec; }
    by.set(k, x);
  });
  const weekday = (iso: string, dir: 1 | -1) => {
    const d = new Date(iso + 'T00:00:00Z');
    while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + dir);
    return d.toISOString().slice(0, 10);
  };
  const full = [...by.keys()].sort().filter((m) => {
    const first = weekday(`${m}-01`, 1);
    const lastDay = new Date(`${m}-01T00:00:00Z`); lastDay.setUTCMonth(lastDay.getUTCMonth() + 1); lastDay.setUTCDate(0);
    const last = weekday(lastDay.toISOString().slice(0, 10), -1);
    return dataStart <= first && end >= last;
  });
  if (full.length < 2) return null;
  const [pk, ck] = full.slice(-2);
  const stat = (k: string) => {
    const x = by.get(k)!;
    return { month: k, activity: x.online ? (x.active / x.online) * 100 : 0, attendance: x.t ? (x.p / x.t) * 100 : 0 };
  };
  return { prev: stat(pk), cur: stat(ck) };
}
const monthName = (k: string) => new Date(`${k}-01T00:00:00Z`).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });

export function computeInsightRules(ds: Dataset, sc: Scope, stats: PersonStat[], cap: CapacityConfig): Insight[] {
  const r = ds.config.defaults.insightRules;
  const cfg = ds.config;
  const wd = Math.max(1, sc.range.workingDays);
  const until = fmtDate(sc.range.end);
  const present = stats.filter((p) => p.presentDays > 0);
  const reliable = stats.filter((p) => p.presentDays >= cfg.minPresentDaysForLists);
  const headcount = Math.max(1, present.length);
  const out: Insight[] = [];

  // capacity band (shared with the Time & Capacity tab)
  const min = cap.benchmark * (1 - cap.variancePct / 100);
  const max = cap.benchmark * (1 + cap.variancePct / 100);
  const band = (v: number) => (v < min ? 'under' : v > max ? 'over' : 'healthy');
  const split = { under: 0, healthy: 0, over: 0 };
  present.forEach((p) => split[band(p.avg[cap.metric])]++);
  const overDayShare = (p: PersonStat) => (p.presentDays ? (p.daysByMetric[cap.metric].filter((h) => h > max).length / p.presentDays) * 100 : 0);
  const dayShareBase = present.filter((p) => p.presentDays > r.minPresentDaysForDayShare);
  const leisure = (p: PersonStat) => r.leisureCategories.reduce((a, c) => a + (p.catHrs[c] ?? 0), 0);

  /* ============================== ACT NOW ============================== */

  // 1. apps / URLs that need category mapping, used > N h per working day
  const unprod = topItems(sc, { productivity: 'unproductive', n: 200 });
  const toMap = unprod.filter((u) =>
    (u.category === 'Uncategorised' || (!cfg.nonWorkCategories.includes(u.category) && u.people >= 3 && !/news|msn/i.test(u.category + u.name)))
    && u.hours / wd > r.mappingHrsPerDay);
  if (toMap.length) {
    const total = toMap.reduce((a, u) => a + u.hours, 0);
    out.push({
      id: 'act.mapping', tone: 'priority', pages: ['overview', 'apps'],
      title: `${plural(toMap.length, 'app/URL', 'apps/URLs')} need category mapping`,
      body: `Each takes more than ${r.mappingHrsPerDay}h a day across the team: ${toMap.slice(0, 3).map((u) => `${u.name} (${fmtN(u.hours)}h)`).join(', ')}${toMap.length > 3 ? ' and more' : ''}. Total until ${until}.`,
      metric: { value: `${fmtN(total)}h`, label: 'spent so far' },
      link: { page: 'apps', anchor: 'urls' },
    });
  }

  // 2. people averaging active < N h a day
  const lowActive = reliable.filter((p) => p.avg.active < r.lowActiveHrs);
  if (lowActive.length) out.push({
    id: 'act.lowActive', tone: 'priority', pages: ['overview', 'cohorts'],
    title: `${plural(lowActive.length, 'person', 'people')} average under ${r.lowActiveHrs}h active a day`,
    body: `Most in ${topGroups(lowActive)}. Confirm role, device and tracking before any conversation.`,
    metric: { value: fmtN(lowActive.length), label: lowActive.length === 1 ? 'person' : 'people' },
    link: { page: 'cohorts', anchor: 'threshold' },
  });

  // 3. presence coverage gap: online < N h on at least M present days
  const gap = present.filter((p) => p.daysByMetric.online.filter((h) => h < r.lowOnlineHrs).length >= r.lowOnlineMinDays);
  if (gap.length) out.push({
    id: 'act.presenceGap', tone: 'priority', pages: ['overview', 'capacity'],
    title: `Presence coverage gap: ${plural(gap.length, 'person', 'people')} online under ${r.lowOnlineHrs}h on ${r.lowOnlineMinDays}+ days`,
    body: `Most in ${topGroups(gap)}. Punched in but barely online - usually the agent stopping, a second device, or very short logins.`,
    metric: { value: fmtN(gap.length), label: 'people' },
    link: { page: 'overview', anchor: 'coverage' },
  });

  // 4. teams where productive < neutral and neutral > N h/day
  const teams = new Map<string, { n: number; prod: number; neu: number }>();
  present.forEach((p) => {
    const t = teams.get(p.emp.team) ?? { n: 0, prod: 0, neu: 0 };
    t.n += p.presentDays; t.prod += p.sum.productive; t.neu += p.sum.neutral;
    teams.set(p.emp.team, t);
  });
  const neutralTeams = [...teams.entries()]
    .map(([name, t]) => ({ name, prod: H(t.prod) / Math.max(1, t.n), neu: H(t.neu) / Math.max(1, t.n), total: H(t.neu) }))
    .filter((t) => t.prod < t.neu && t.neu > r.neutralHrs)
    .sort((a, b) => b.total - a.total);
  if (neutralTeams.length) out.push({
    id: 'act.neutralTeams', tone: 'priority', pages: ['overview', 'teams'],
    title: `${plural(neutralTeams.length, 'team')} spend more time neutral than productive`,
    metric: { value: `${fmtN(neutralTeams.reduce((a, t) => a + t.total, 0))}h`, label: 'neutral so far' },
    body: `Neutral over ${r.neutralHrs}h a day and above productive time: ${neutralTeams.slice(0, 3).map((t) => `${t.name} (${fmtH(t.neu)}/day neutral)`).join(', ')}. ${fmtN(neutralTeams.reduce((a, t) => a + t.total, 0))} neutral hours until ${until} - review how their tools are tagged.`,
    link: { page: 'teams', anchor: 'composition' },
  });

  // 5. underutilised band > N% of headcount
  const underPct = (split.under / headcount) * 100;
  if (underPct > r.underBandSharePct) out.push({
    id: 'act.underBand', tone: 'priority', pages: ['overview', 'capacity'],
    title: `${fmtPct(underPct)} of people are underutilised`,
    metric: { value: fmtPct(underPct), label: `${fmtN(split.under)} people` },
    body: `${fmtN(split.under)} of ${fmtN(headcount)} people average under ${min.toFixed(1)}h ${cap.metric} a day (benchmark ${cap.benchmark}h −${cap.variancePct}%). More than ${r.underBandSharePct}% of the workforce.`,
    link: { page: 'capacity', anchor: 'lens' },
  });

  // 6. any time on gaming / adult / gambling
  const severe = present.filter((p) => r.severeCategories.some((c) => (p.catHrs[c] ?? 0) > 0));
  if (severe.length) {
    const per = r.severeCategories.map((c) => ({ c, n: present.filter((p) => (p.catHrs[c] ?? 0) > 0).length, h: present.reduce((a, p) => a + (p.catHrs[c] ?? 0), 0) })).filter((x) => x.n);
    out.push({
      id: 'act.severeNonWork', tone: 'priority', pages: ['overview', 'apps'],
      title: `${plural(severe.length, 'person', 'people')} used ${listJoin(r.severeCategories.map((c) => c.toLowerCase()), 'or')} sites`,
      body: `${per.map((x, i) => `${i ? x.c.toLowerCase() : x.c} ${x.h.toFixed(1)}h`).join(', ')} in this period. Handle privately.`,
      metric: { value: fmtN(severe.length), label: 'people' },
      link: { page: 'apps', anchor: 'screening' },
    });
  }

  /* ============================== OPPORTUNITY ============================== */

  // 1. video / social between min and max h per present day
  const leisureMid = present.filter((p) => { const d = leisure(p) / p.presentDays; return d > r.leisureMinHrs && d < r.leisureMaxHrs; });
  if (leisureMid.length) out.push({
    id: 'opp.leisure', tone: 'opportunity', pages: ['apps'],
    title: `${plural(leisureMid.length, 'person', 'people')} spend ${r.leisureMinHrs}–${r.leisureMaxHrs}h a day on ${r.leisureCategories.join(' / ').toLowerCase()}`,
    body: 'Not yet a policy issue, but enough to raise in a regular check-in.',
    metric: { value: fmtN(leisureMid.length), label: 'people' },
    link: { page: 'apps', anchor: 'screening' },
  });

  // 2. AI use above 0 and below N h per present day
  const lightAi = present.filter((p) => { const d = p.aiHrs / p.presentDays; return d > 0 && d < r.aiMaxHrs; });
  if (lightAi.length) out.push({
    id: 'opp.lightAi', tone: 'opportunity', pages: ['ai'],
    title: `${plural(lightAi.length, 'person', 'people')} use AI tools, but under ${r.aiMaxHrs}h a day`,
    metric: { value: fmtN(lightAi.length), label: 'people' },
    body: `${fmtPct((lightAi.length / headcount) * 100)} of present people have started. Short, role-specific use cases from the power users can deepen it.`,
    link: { page: 'ai', anchor: 'power' },
  });

  // 3. healthy band < N% of headcount
  const healthyPct = (split.healthy / headcount) * 100;
  if (healthyPct < r.healthySharePct) out.push({
    id: 'opp.healthy', tone: 'opportunity', pages: ['capacity'],
    title: `Only ${fmtPct(healthyPct)} of people are in the healthy band`,
    metric: { value: fmtPct(healthyPct), label: 'healthy' },
    body: `${fmtPct((split.under / headcount) * 100)} underutilised and ${fmtPct((split.over / headcount) * 100)} overburdened against ${min.toFixed(1)}–${max.toFixed(1)}h ${cap.metric} a day. Rebalancing work between the two groups is the lever.`,
    link: { page: 'capacity', anchor: 'lens' },
  });

  // 4. productive < N h/day while online > M h/day
  const lowProd = reliable.filter((p) => p.avg.productive < r.lowProductiveHrs && p.avg.online > r.minOnlineHrs);
  if (lowProd.length) out.push({
    id: 'opp.lowProductive', tone: 'opportunity', pages: ['cohorts', 'teams'],
    title: `${plural(lowProd.length, 'person', 'people')} are online over ${r.minOnlineHrs}h but productive under ${r.lowProductiveHrs}h a day`,
    body: `Most in ${topGroups(lowProd)}. Present and logged in, but little time on productive-tagged work - check tagging, then workload.`,
    metric: { value: fmtN(lowProd.length), label: 'people' },
    link: { page: 'cohorts', anchor: 'mine' },
  });

  // 5. overburdened on > N% of present days (more than M present days)
  const overMost = dayShareBase.filter((p) => overDayShare(p) > r.overDaysSharePct);
  if (overMost.length) out.push({
    id: 'opp.overDays', tone: 'opportunity', pages: ['capacity'],
    title: `${plural(overMost.length, 'person', 'people')} are overburdened on most days`,
    metric: { value: fmtN(overMost.length), label: 'people' },
    body: `Above ${max.toFixed(1)}h ${cap.metric} on more than ${r.overDaysSharePct}% of their present days (${r.minPresentDaysForDayShare}+ days). A wellbeing risk worth a workload check.`,
    link: { page: 'capacity', anchor: 'lens' },
  });

  /* ============================== KEEP AS IS ============================== */

  // 1. leisure total < N h (period of at least a month)
  const leisureTotal = present.reduce((a, p) => a + leisure(p), 0);
  if (wd >= 20 && leisureTotal < r.leisureKeepHrs) out.push({
    id: 'keep.leisure', tone: 'maintain', pages: ['apps'],
    title: `${r.leisureCategories.join(' and ')} stay under ${r.leisureKeepHrs} h`,
    body: `${leisureTotal.toFixed(1)}h in total for the selected period. No action needed.`,
    metric: { value: `${leisureTotal.toFixed(1)}h`, label: 'in period' },
    link: { page: 'apps', anchor: 'screening' },
  });

  // 2. overburdened on N-M% of present days
  const [lo, hi] = r.overDaysKeepRangePct;
  const overSome = dayShareBase.filter((p) => { const s = overDayShare(p); return s >= lo && s <= hi; });
  if (overSome.length) out.push({
    id: 'keep.overDays', tone: 'maintain', pages: ['capacity'],
    title: `${plural(overSome.length, 'person', 'people')} run over on ${lo}–${hi}% of days`,
    metric: { value: fmtN(overSome.length), label: 'people' },
    body: `Occasional long days above ${max.toFixed(1)}h ${cap.metric}. Normal peaks - keep an eye on it, no action needed.`,
    link: { page: 'capacity', anchor: 'lens' },
  });

  // 3 & 4. month-on-month activity % and attendance %
  const mom = monthOverMonth(ds, sc);
  if (mom) {
    const chg = (a: number, b: number) => (a ? ((b - a) / a) * 100 : 0);
    const act = chg(mom.prev.activity, mom.cur.activity);
    const att = chg(mom.prev.attendance, mom.cur.attendance);
    if (Math.abs(act) < r.monthlyChangePct) out.push({
      id: 'keep.activity', tone: 'maintain', pages: ['teams'],
      title: 'Activity is steady month on month',
      metric: { value: `${act >= 0 ? '+' : ''}${act.toFixed(1)}%`, label: 'activity change' },
      body: `Active share of online time ${fmtPct(mom.prev.activity, 1)} in ${monthName(mom.prev.month)} → ${fmtPct(mom.cur.activity, 1)} in ${monthName(mom.cur.month)}. Within ±${r.monthlyChangePct}%.`,
      link: { page: 'teams', anchor: 'monthly' },
    });
    if (Math.abs(att) < r.monthlyChangePct) out.push({
      id: 'keep.attendance', tone: 'maintain', pages: ['teams', 'capacity'],
      title: 'Attendance is steady month on month',
      metric: { value: `${att >= 0 ? '+' : ''}${att.toFixed(1)}%`, label: 'attendance change' },
      body: `Days with a presence signal ${fmtPct(mom.prev.attendance, 1)} in ${monthName(mom.prev.month)} → ${fmtPct(mom.cur.attendance, 1)} in ${monthName(mom.cur.month)}. Within ±${r.monthlyChangePct}%.`,
      link: { page: 'teams', anchor: 'monthly' },
    });
  }

  // 5. unproductive time < N% of tracked time
  const tot = usageTotals(sc);
  const unprodPct = tot.total ? (tot.unproductive / tot.total) * 100 : 0;
  if (tot.total && unprodPct < r.unproductiveSharePct) out.push({
    id: 'keep.unproductive', tone: 'maintain', pages: ['apps'],
    title: `Only ${fmtPct(unprodPct, 1)} of tracked time is on unproductive apps`,
    metric: { value: fmtPct(unprodPct, 1), label: 'of tracked time' },
    body: `${fmtN(tot.unproductive)} of ${fmtN(tot.total)} h, under the ${r.unproductiveSharePct}% line. No blanket restriction needed.`,
    link: { page: 'apps', anchor: 'top' },
  });

  return out;
}
