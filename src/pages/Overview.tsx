import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useDash } from '../state';
import { CHART, InsightPanel, Kpi, PageHeader, Section, ThresholdControl } from '../components/ui';
import {
  aiAdoption, coverage, fmtH, fmtN, fmtPct, groupStats, MEASURE_LABEL, monthlyTrend, nonWork, orgAvg,
  redFlags, thresholdText, topItems, compare,
} from '../lib/metrics';
import { aiInsight, coverageInsight, mappingInsight, misTagCandidates, nonWorkInsight, redFlagInsight, underTeamsInsight } from '../lib/insights';

export function OverviewPage() {
  const { ds, scope, stats, reliable, under, setUnder, redFlag, go } = useDash();
  const cfg = ds.config;

  const d = useMemo(() => {
    const cov = coverage(scope);
    const avg = orgAvg(stats);
    const ai = aiAdoption(scope, stats);
    const flags = redFlags(stats, redFlag, cfg.defaults.individualsThreshold);
    const underN = reliable.filter((s) => compare(s.avg[under.metric], under.op, under.value)).length;
    const nw = nonWork(scope, stats, 10);
    const depts = groupStats(stats, 'department', under, cfg.minGroupSize, cfg.minPresentDaysForLists);
    const unprod = topItems(scope, { productivity: 'unproductive', n: 15 });
    const unassigned = cfg.unassignedDepartment ? stats.filter((s) => s.emp.department === cfg.unassignedDepartment).length : 0;
    const trend = monthlyTrend(scope, stats);
    return { cov, avg, ai, flags, underN, nw, depts, unprod, unassigned, trend };
  }, [scope, stats, reliable, under, redFlag, cfg]);

  const ruleText = redFlag.rules.filter((r) => r.enabled)
    .map((r) => `${MEASURE_LABEL[r.measure].label.toLowerCase()} ${r.op} ${r.value}${MEASURE_LABEL[r.measure].unit}`)
    .join(redFlag.combine === 'all' ? ' and ' : ' or ') + ` (${redFlag.minPresentDays}+ present days)`;
  const underPct = reliable.length ? (d.underN / reliable.length) * 100 : 0;
  const tools = d.ai.byTool.map((t) => t.tool);

  const insights = [
    redFlagInsight(d.flags.length, ruleText),
    mappingInsight(misTagCandidates(d.unprod, cfg.nonWorkCategories)),
    coverageInsight(100 - d.cov.pct, d.unassigned, cfg.unassignedDepartment),
    underTeamsInsight(d.depts, under, underPct),
    nonWorkInsight(d.nw.sharePct, d.nw.total, d.nw.heavy, 10),
    aiInsight(d.ai.adoptionPct, d.ai.nonHubPct, d.ai.perUserPerMonth, cfg.aiHubTool),
  ].filter(Boolean) as NonNullable<ReturnType<typeof coverageInsight>>[];

  const pie = [
    { name: 'Present (punch / online)', value: d.cov.present, color: CHART.green },
    { name: 'No presence signal', value: d.cov.missing, color: CHART.grey },
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
        <Kpi value={fmtN(d.flags.length)} label="Red-flag individuals" tone="bad" sub={redFlag.minPresentDays > scope.range.workingDays ? `Rule needs ${redFlag.minPresentDays}+ days - adjust on People` : 'Need a closer look'} onClick={() => go('people', 'redflags')} />
        <Kpi value={fmtPct(underPct)} label="Under-utilised workforce" tone="warn" sub={`${thresholdText(under)}, of ${fmtN(reliable.length)} people with ${cfg.minPresentDaysForLists}+ days`} onClick={() => go('teams', 'cohorts')} />
        <Kpi value={fmtPct(d.nw.sharePct, 2)} label="Non-work browsing" tone="good" sub={`${fmtN(d.nw.total)} hrs - ${d.nw.sharePct < 1 ? 'negligible' : 'worth a look'}`} onClick={() => go('apps', 'screening')} />
      </div>

      <InsightPanel items={insights} title="Where to act" />

      <div className="grid">
        <Section span={7} title="Presence coverage" note="Hours throughout this dashboard use present days only, so leave, holidays or missing agent data never count as zero activity.">
          <div className="coverage">
            <div className="coverage-chart">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pie} dataKey="value" innerRadius={58} outerRadius={88} startAngle={90} endAngle={-270} stroke="none">
                    {pie.map((p) => <Cell key={p.name} fill={p.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtN(v)} />
                </PieChart>
              </ResponsiveContainer>
              <span className="donut-center">{fmtPct(d.cov.pct, 1)}</span>
            </div>
            <div className="coverage-text">
              <p className="big-number">{fmtN(d.cov.total)}</p>
              <p className="muted">tracked person-days in the {scope.range.workingDays}-working-day window</p>
              <ul className="legend">
                {pie.map((p) => <li key={p.name}><i style={{ background: p.color }} />{p.name}: <b>{fmtN(p.value)}</b></li>)}
              </ul>
            </div>
          </div>
        </Section>
        <Section span={5} title="Under-utilised means" note="This definition drives the under-utilised card, team bands and department counts across the dashboard.">
          <ThresholdControl value={under} onChange={setUnder} prefix="Average" />
          <p className="explain">
            <b>{fmtN(d.underN)}</b> of {fmtN(reliable.length)} people currently meet it. Change the metric to productive or online time, or move the line, and every page updates.
          </p>
        </Section>
      </div>
    </>
  );
}
