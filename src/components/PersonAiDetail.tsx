import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useDash } from '../state';
import { axisProps, CHART, DataTable, DetailHeader, Section, Stat } from './ui';
import { capacityBand, fmtH, fmtN, fmtPct, H, monthsIn, type PersonStat } from '../lib/metrics';
import { LOAD_COLOR, LOAD_LABEL } from './capacityViews';

/** One person's AI-assistant use: by tool, by month, every AI app / site, and their working day for context. */
export function PersonAiDetail({ person, rank, adopters }: { person: PersonStat; rank: number; adopters: number }) {
  const { scope, capacityCfg, org } = useDash();
  const id = person.emp.id;

  const { byTool, byMonth, items } = useMemo(() => {
    const tools = new Map<string, number>(), item = new Map<string, { tool: string; hours: number }>();
    const months = monthsIn(scope);
    const monthIdx = new Map(months.map((m, i) => [m.key, i]));
    const perMonth = months.map((m) => ({ month: m.label, hours: 0 }));
    for (const u of scope.usage) {
      if (u.employeeId !== id) continue;
      const tool = scope.aiToolOf(u.name);
      if (!tool) continue;
      const h = H(u.activeSec);
      tools.set(tool, (tools.get(tool) ?? 0) + h);
      const it = item.get(u.name) ?? { tool, hours: 0 };
      it.hours += h; item.set(u.name, it);
      const i = monthIdx.get(u.date.slice(0, 7));
      if (i !== undefined) perMonth[i].hours += h;
    }
    return {
      byTool: [...tools.entries()].map(([tool, hours]) => ({ tool, hours: +hours.toFixed(2) })).sort((a, b) => b.hours - a.hours),
      byMonth: perMonth.map((m) => ({ ...m, hours: +m.hours.toFixed(2) })),
      items: [...item.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.hours - a.hours),
    };
  }, [scope, id]);

  const perDay = person.presentDays ? person.aiHrs / person.presentDays : 0;
  const shareOfActive = person.sum.active ? (person.aiHrs / H(person.sum.active)) * 100 : 0;
  const band = capacityBand(capacityCfg);
  const load = band.status(person.avg[capacityCfg.metric]);
  const topTool = byTool[0];

  return (
    <>
      <DetailHeader title={person.emp.name}
        lede={`${person.emp.team}${org.teamsOnly ? '' : ` · ${person.emp.department}`} · AI power user #${rank} of ${fmtN(adopters)} AI users · ${person.presentDays} present days in the period.`} />
      <div className="grid">
        <Section title="AI use at a glance">
          <div className="stat-row">
            <Stat value={`${person.aiHrs.toFixed(1)} h`} label="on AI assistants in the period" />
            <Stat value={perDay < 1 ? `${Math.round(perDay * 60)} min` : fmtH(perDay, 2)} label="per present day" />
            <Stat value={fmtPct(shareOfActive, 1)} label="of their active time" />
            <Stat value={topTool ? topTool.tool : '–'} label={topTool ? `most used · ${fmtPct((topTool.hours / Math.max(0.01, person.aiHrs)) * 100)} of AI time · ${byTool.length} tool${byTool.length === 1 ? '' : 's'}` : 'no AI use'} />
          </div>
        </Section>

        <Section span={6} title="By tool">
          <ResponsiveContainer width="100%" height={Math.max(180, byTool.length * 34 + 40)}>
            <BarChart data={byTool} layout="vertical" margin={{ top: 0, right: 50, bottom: 0, left: 0 }} maxBarSize={26}>
              <CartesianGrid stroke={CHART.grid} horizontal={false} />
              <XAxis type="number" {...axisProps} unit="h" />
              <YAxis type="category" dataKey="tool" {...axisProps} width={160} interval={0} />
              <Tooltip formatter={(v: number) => [`${v}h`, 'Time on tool']} cursor={{ fill: 'rgba(229, 223, 255, .35)' }} />
              <Bar dataKey="hours" fill={CHART.ai} radius={[0, 3, 3, 0]} label={{ position: 'right', fill: CHART.axis, fontSize: 12, formatter: (v: number) => `${v}h` }} />
            </BarChart>
          </ResponsiveContainer>
        </Section>

        <Section span={6} title="By month" note="* marks a month only partly inside the selected period.">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byMonth} margin={{ top: 16, right: 10, bottom: 0, left: 0 }} maxBarSize={44}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...axisProps} unit="h" />
              <Tooltip formatter={(v: number) => [`${v}h`, 'AI time']} cursor={{ fill: 'rgba(229, 223, 255, .35)' }} />
              <Bar dataKey="hours" fill={CHART.ai} radius={[3, 3, 0, 0]} label={{ position: 'top', fill: CHART.axis, fontSize: 12, formatter: (v: number) => (v ? `${v}h` : '') }} />
            </BarChart>
          </ResponsiveContainer>
        </Section>

        <Section span={7} title="AI apps & sites used">
          <DataTable rows={items} initialSort={{ key: 'h', dir: 'desc' }} cols={[
            { key: 'name', label: 'App / site', get: (r) => r.name },
            { key: 'tool', label: 'Tool', get: (r) => r.tool },
            { key: 'h', label: 'Hours', align: 'right', get: (r) => r.hours, render: (r) => r.hours.toFixed(2) },
            { key: 's', label: 'Share of AI time', align: 'right', get: (r) => r.hours, render: (r) => fmtPct((r.hours / Math.max(0.01, person.aiHrs)) * 100) },
          ]} />
        </Section>

        <Section span={5} title="Their working day" note="Averages per present day, for context.">
          <dl className="facts">
            <dt>Online</dt><dd>{fmtH(person.avg.online, 2)}</dd>
            <dt>Active</dt><dd>{fmtH(person.avg.active, 2)}</dd>
            <dt>Productive</dt><dd>{fmtH(person.avg.productive, 2)} <span className="muted">({fmtPct(person.productivePct)} of active)</span></dd>
            <dt>Capacity status</dt><dd style={{ color: LOAD_COLOR[load] }}>{LOAD_LABEL[load]} <span className="muted">({band.min}–{band.max}h {capacityCfg.metric} band)</span></dd>
            <dt>Present days</dt><dd>{person.presentDays} of {person.trackedDays}</dd>
          </dl>
        </Section>
      </div>
    </>
  );
}
