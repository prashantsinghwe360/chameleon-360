import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useDash } from '../state';
import { axisProps, CHART, DataTable, InsightPanel, NumberField, PageHeader, Section, Stat, ThresholdControl } from '../components/ui';
import { aiAdoption, compare, fmtH, fmtN, fmtPct, METRIC_LABEL, thresholdText } from '../lib/metrics';

export function AIPage() {
  const { ds, scope, stats, rulesFor } = useDash();
  const cfg = ds.config;
  const [lowT, setLowT] = useState(cfg.defaults.individualsThreshold);
  const [powerN, setPowerN] = useState(cfg.defaults.aiPowerUserCount);

  const ai = useMemo(() => aiAdoption(scope, stats), [scope, stats]);
  const nonAi = useMemo(() => stats.filter((s) => s.aiHrs === 0), [stats]);
  const nonAiLow = useMemo(() => nonAi.filter((s) => s.presentDays >= cfg.minPresentDaysForLists && compare(s.avg[lowT.metric], lowT.op, lowT.value)), [nonAi, lowT, cfg]);
  const power = useMemo(() => [...stats].filter((s) => s.aiHrs > 0).sort((a, b) => b.aiHrs - a.aiHrs).slice(0, powerN), [stats, powerN]);

  const insights = rulesFor('ai');

  const donut = [
    { name: 'Used an AI tool', value: ai.adopters, color: CHART.ai },
    { name: 'No AI tool use found', value: ai.people - ai.adopters, color: CHART.missing },
  ];

  return (
    <>
      <PageHeader title="AI adoption" lede="Who uses AI assistants, which tools, how deeply, and who has not started yet." />
      <InsightPanel items={insights} />
      <div className="grid">
        <Section id="adoption" span={5} title="AI workforce adoption" note={cfg.aiHubTool ? `${cfg.aiHubTool} also launches Office apps, so adoption is shown with and without it.` : undefined}>
          <div className="coverage">
            <div className="coverage-chart">
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie data={donut} dataKey="value" innerRadius={55} outerRadius={84} startAngle={90} endAngle={-270} stroke="none">
                    {donut.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <span className="donut-center">{fmtPct(ai.adoptionPct)}</span>
            </div>
            <div className="stat-stack">
              <Stat value={`${fmtN(ai.adopters)} / ${fmtN(ai.people)}`} label="people used an AI tool" />
              {cfg.aiHubTool && <Stat value={fmtPct(ai.nonHubPct)} label={`adoption excluding ${cfg.aiHubTool}`} />}
              <Stat value={`${fmtN(ai.totalHrs)} h`} label={`total AI time · ${fmtH(ai.perUserPerMonth)} per user per month`} />
            </div>
          </div>
        </Section>

        <Section id="tools" span={7} title="Users by tool" note="A person counts once per tool they used in the period.">
          <ResponsiveContainer width="100%" height={Math.max(240, ai.byTool.length * 26)}>
            <BarChart data={ai.byTool} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={CHART.grid} horizontal={false} />
              <XAxis type="number" {...axisProps} allowDecimals={false} />
              <YAxis type="category" dataKey="tool" {...axisProps} width={150} />
              <Tooltip cursor={{ fill: 'rgba(229, 223, 255, .35)' }} content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const t = payload[0].payload as { tool: string; users: number; hours: number };
                return (
                  <div className="chart-tip">
                    <b>{t.tool}</b>
                    <span>{fmtN(t.users)} users</span>
                    <span>{fmtN(t.hours)} h total time on tool</span>
                    <span className="muted">{fmtH(t.users ? t.hours / t.users : 0)} per user</span>
                  </div>
                );
              }} />
              <Bar dataKey="users" name="Users" fill={CHART.ai} radius={[0, 3, 3, 0]} label={{ position: 'right', fill: CHART.axis, fontSize: 12 }} />
            </BarChart>
          </ResponsiveContainer>
        </Section>

        <Section id="nonai" title="People with no AI use"
          tools={<ThresholdControl value={lowT} onChange={setLowT} prefix="Also averaging" />}
          note={`${fmtN(nonAi.length)} of ${fmtN(ai.people)} people show no AI-assistant use. ${fmtN(nonAiLow.length)} of them also average ${thresholdText(lowT)} (${cfg.minPresentDaysForLists}+ present days).`}>
          <DataTable rows={nonAiLow} max={10} initialSort={{ key: 'v', dir: 'asc' }} cols={[
            { key: 'name', label: 'Name', get: (r) => r.emp.name },
            { key: 'dept', label: 'Department', get: (r) => r.emp.department },
            { key: 'v', label: `Avg ${METRIC_LABEL[lowT.metric].toLowerCase()}`, align: 'right', get: (r) => r.avg[lowT.metric], render: (r) => fmtH(r.avg[lowT.metric], 2) },
            { key: 'o', label: 'Avg online', align: 'right', get: (r) => r.avg.online, render: (r) => fmtH(r.avg.online, 2) },
            { key: 'd', label: 'Days', align: 'right', get: (r) => r.presentDays },
          ]} />
        </Section>

        <Section id="trend" title="Monthly AI-tool usage" note="* marks a month only partly inside the selected period.">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={ai.monthly} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis yAxisId="h" {...axisProps} unit="h" />
              <YAxis yAxisId="u" orientation="right" {...axisProps} allowDecimals={false} />
              <Tooltip />
              <Legend verticalAlign="top" height={28} />
              <Bar yAxisId="h" dataKey="hours" name="AI hours" fill={CHART.ai} radius={[3, 3, 0, 0]} />
              <Line yAxisId="u" dataKey="users" name="Distinct users" stroke={CHART.aiLine} strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Section>
        <Section id="power" title="AI power users"
          tools={<><span className="ctl-label">Show top</span><NumberField label="Number of power users" value={powerN} step={1} min={1} onChange={(v) => setPowerN(Math.max(1, Math.round(v)))} /></>}
          note="Total AI-assistant hours in the period. Hover a bar for department and tools used.">
          <ResponsiveContainer width="100%" height={Math.max(240, power.length * 30 + 30)}>
            <BarChart data={power.map((p) => ({ name: p.emp.name, dept: p.emp.department, tools: [...p.aiTools].join(', '), hours: +p.aiHrs.toFixed(1) }))}
              layout="vertical" margin={{ top: 0, right: 50, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={CHART.grid} horizontal={false} />
              <XAxis type="number" {...axisProps} unit="h" />
              <YAxis type="category" dataKey="name" {...axisProps} width={180} interval={0} />
              <Tooltip cursor={{ fill: 'rgba(229, 223, 255, .35)' }} content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as { name: string; dept: string; tools: string; hours: number };
                return (
                  <div className="chart-tip">
                    <b>{p.name}</b>
                    <span className="muted">{p.dept}</span>
                    <span>{p.hours} h on AI tools</span>
                    <span className="muted">{p.tools}</span>
                  </div>
                );
              }} />
              <Bar dataKey="hours" fill={CHART.ai} radius={[0, 3, 3, 0]} label={{ position: 'right', fill: CHART.axis, fontSize: 12, formatter: (v: number) => `${v}h` }} />
            </BarChart>
          </ResponsiveContainer>
        </Section>

      </div>
    </>
  );
}
