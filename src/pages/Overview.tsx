import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useDash } from '../state';
import { family } from '../theme/tokens';
import { CHART, InsightPanel, Kpi, PageHeader, Section } from '../components/ui';
import {
  aiAdoption, capacityBand, coverage, fmtH, fmtN, fmtPct, groupStats, monthlyTrend, nonWork, orgAvg,
  redFlags, topItems,
} from '../lib/metrics';

export function OverviewPage() {
  const { ds, scope, stats, reliable, under, redFlag, go, rulesFor, teamLabel, capacityCfg } = useDash();
  const cfg = ds.config;

  const d = useMemo(() => {
    const cov = coverage(scope);
    const avg = orgAvg(stats);
    const ai = aiAdoption(scope, stats);
    const flags = redFlags(stats, redFlag, cfg.defaults.individualsThreshold);
    const band = capacityBand(capacityCfg);
    const underN = reliable.filter((s) => s.avg[capacityCfg.metric] < band.min).length;
    const nw = nonWork(scope, stats, 10);
    const depts = groupStats(stats, 'department', under, cfg.minGroupSize, cfg.minPresentDaysForLists);
    const unprod = topItems(scope, { productivity: 'unproductive', n: 15 });
    const unassigned = cfg.unassignedDepartment ? stats.filter((s) => s.emp.department === cfg.unassignedDepartment).length : 0;
    const trend = monthlyTrend(scope, stats);
    // people grouped by share of their own expected days with a presence signal
    const rate = new Map<string, { t: number; p: number }>();
    scope.daily.forEach((x) => { const r = rate.get(x.employeeId) ?? { t: 0, p: 0 }; r.t++; if (x.present) r.p++; rate.set(x.employeeId, r); });
    const rates = [...rate.values()].map((r) => (r.t ? r.p / r.t : 0));
    const presence = [
      { label: 'Present on 90%+ of days', people: rates.filter((x) => x >= 0.9).length, color: CHART.present },
      { label: '50–90% of days', people: rates.filter((x) => x >= 0.5 && x < 0.9).length, color: CHART.over },
      { label: 'Under 50% of days', people: rates.filter((x) => x < 0.5).length, color: CHART.under },
    ];
    return { cov, avg, ai, flags, underN, nw, depts, unprod, unassigned, trend, presence };
  }, [scope, stats, reliable, under, redFlag, cfg, capacityCfg]);

  const underPct = reliable.length ? (d.underN / reliable.length) * 100 : 0;
  const tools = d.ai.byTool.map((t) => t.tool);

  const actNow = rulesFor('overview', ['priority']);

  const reasonColor = (r: string) => (/leave|holiday/i.test(r) ? family.lavender.light : /track|signal/i.test(r) ? CHART.missing : family.coralRed.light);
  const reasons = Object.entries(d.cov.byReason).sort((a, b) => b[1] - a[1]);
  const pie = [
    { name: 'Present (punch / online signal)', value: d.cov.present, color: CHART.present },
    ...(reasons.length === 1 && reasons[0][0] === 'No presence signal'
      ? [{ name: 'No signal (leave, holiday, missing data)', value: d.cov.missing, color: CHART.missing }]
      : reasons.map(([r, n]) => ({ name: r, value: n, color: reasonColor(r) }))),
  ];

  return (
    <>
      <PageHeader
        title="Workforce at a glance"
        lede="Who is active, who is using modern tools, and where attention is most needed right now. Select a card to open its detail."
      />

      <div className="kpi-grid">
        <Kpi value={fmtN(stats.length)} label="People tracked" sub={`${d.cov.total ? scope.range.workingDays : 0} working days in range`} onClick={() => go('teams', 'patterns')} />
        <Kpi value={fmtH(d.avg.active)} label="Avg. active hrs / present day" sub={`Online ${fmtH(d.avg.online)} · productive ${fmtH(d.avg.productive)}`} onClick={() => go('teams', 'monthly')} />
        <Kpi value={fmtPct(d.ai.adoptionPct)} label="AI tool adoption" tone="good" sub={`${tools.slice(0, 3).join(', ')}${tools.length > 3 ? ` + ${tools.length - 3} more` : ''}`} onClick={() => go('ai', 'adoption')} />
        <Kpi value={fmtN(d.flags.length)} label="Red-flag individuals" tone="bad" sub={redFlag.minPresentDays > scope.range.workingDays ? `Rule needs ${redFlag.minPresentDays}+ days - adjust on Cohorts` : 'Need a closer look'} onClick={() => go('cohorts', 'redflags')} />
        <Kpi value={fmtPct(underPct)} label="Under-utilised workforce" tone="warn" sub={`${capacityCfg.metric} < ${capacityBand(capacityCfg).min}h/day (capacity band), of ${fmtN(reliable.length)} people with ${cfg.minPresentDaysForLists}+ days`} onClick={() => go('capacity', 'lens')} />
        <Kpi value={fmtPct(d.nw.sharePct, 2)} label="Non-work browsing" tone="good" sub={`${fmtN(d.nw.total)} hrs - ${d.nw.sharePct < 1 ? 'negligible' : 'worth a look'}`} onClick={() => go('apps', 'screening')} />
      </div>


      <div className="grid">
        <Section id="coverage" title="Presence coverage"
          note="Hours throughout this dashboard use present days only, so leave, holidays or missing agent data never count as zero activity.">
          <div className="coverage coverage-wide">
            <div className="coverage-chart">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pie} dataKey="value" innerRadius={58} outerRadius={88} startAngle={90} endAngle={-270} stroke="none">
                    {pie.map((p) => <Cell key={p.name} fill={p.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${fmtN(v)} person-days`} />
                </PieChart>
              </ResponsiveContainer>
              <span className="donut-center">{fmtPct(d.cov.pct, 1)}</span>
            </div>
            <div className="coverage-text">
              <p className="big-number">{fmtN(stats.length)} <span className="big-unit">people tracked</span></p>
              <p className="muted">
                Across {scope.range.workingDays} working days that is <b>{fmtN(d.cov.total)} person-days</b> of expected presence
                {d.cov.total < stats.length * scope.range.workingDays ? ` (people who joined during the period count only from their join date, so it is less than ${fmtN(stats.length)} × ${scope.range.workingDays})` : ''}.
                {' '}A punch or online signal exists on {fmtPct(d.cov.pct, 1)} of them.
              </p>
              <ul className="legend">
                {pie.map((p) => <li key={p.name}><i style={{ background: p.color }} />{p.name}: <b>{fmtN(p.value)}</b> person-days</li>)}
              </ul>
            </div>
            <div className="presence-split">
              <span className="presence-title">The same {fmtN(stats.length)} people by how often they show up</span>
              {d.presence.map((b) => (
                <div key={b.label} className="presence-row">
                  <span className="presence-label">{b.label}</span>
                  <span className="presence-bar"><i style={{ width: `${(b.people / Math.max(1, stats.length)) * 100}%`, background: b.color }} /></span>
                  <b>{fmtN(b.people)}</b>
                </div>
              ))}
            </div>
          </div>
        </Section>
      </div>

      <div className="act-now">
        {actNow.length
          ? <InsightPanel items={actNow} title="Act now" defaultOpen />
          : <p className="act-empty">Nothing needs immediate action for {teamLabel} in this period.</p>}
      </div>
    </>
  );
}
