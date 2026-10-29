import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useDash } from '../state';
import { PersonAiDetail } from '../components/PersonAiDetail';
import { axisProps, CHART, DataTable, DetailHeader, InsightPanel, NumberField, PageHeader, Section, Select, Stat } from '../components/ui';
import { aiAdoption, fmtH, fmtN, fmtPct, monthsIn } from '../lib/metrics';

export function AIPage() {
  const { ds, scope, stats, rulesFor, org, detail, openDetail } = useDash();
  const cfg = ds.config;
  const [powerN, setPowerN] = useState(cfg.defaults.aiPowerUserCount);
  // filter power users by their TOTAL AI use in the period
  const [totOp, setTotOp] = useState<'>' | '<'>('>');
  const [totVal, setTotVal] = useState(0);
  const [toolPick, setToolPick] = useState<string>('all');   // Users by tool detail
  const [userPick, setUserPick] = useState<string>('all');   // AI power users detail

  const ai = useMemo(() => aiAdoption(scope, stats), [scope, stats]);
  const nonAi = useMemo(() => stats.filter((s) => s.aiHrs === 0), [stats]);
  // everyone with no AI use and enough present days to judge (lowest active time first)
  const nonAiList = useMemo(() => nonAi.filter((s) => s.presentDays >= cfg.minPresentDaysForLists), [nonAi, cfg]);
  const ranked = useMemo(() => [...stats].filter((s) => s.aiHrs > 0).sort((a, b) => b.aiHrs - a.aiHrs), [stats]);
  const avgUse = (p: (typeof ranked)[number]) => (p.presentDays ? p.aiHrs / p.presentDays : 0);
  const filtered = useMemo(() => ranked.filter((p) => (totOp === '>' ? p.aiHrs > totVal : p.aiHrs < totVal)), [ranked, totOp, totVal]);
  const power = useMemo(() => filtered.slice(0, powerN), [filtered, powerN]);

  // per person: hours per tool and first month of AI use (for the detail tables)
  const aiByPerson = useMemo(() => {
    const tools = new Map<string, Map<string, number>>();
    const first = new Map<string, string>();
    for (const u of scope.usage) {
      const t = scope.aiToolOf(u.name); if (!t) continue;
      const m = tools.get(u.employeeId) ?? new Map<string, number>();
      m.set(t, (m.get(t) ?? 0) + u.activeSec / 3600); tools.set(u.employeeId, m);
      const mk = u.date.slice(0, 7);
      if (!first.has(u.employeeId) || mk < first.get(u.employeeId)!) first.set(u.employeeId, mk);
    }
    return { tools, first };
  }, [scope]);
  const topTool = (id: string) => [...(aiByPerson.tools.get(id) ?? new Map()).entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '–';

  // users by tool: table rows
  const toolRows = useMemo(() => ai.byTool.map((t) => {
    const users = stats.filter((p) => p.aiTools.has(t.tool));
    const byTeam = new Map<string, number>();
    users.forEach((p) => byTeam.set(p.emp.team, (byTeam.get(p.emp.team) ?? 0) + 1));
    const lead = [...byTeam.entries()].sort((a, b) => b[1] - a[1])[0];
    return { ...t, pct: (t.users / Math.max(1, ai.people)) * 100, perUser: t.users ? t.hours / t.users : 0,
      share: ai.totalHrs ? (t.hours / ai.totalHrs) * 100 : 0, lead: lead ? `${lead[0]} (${lead[1]})` : '–' };
  }), [ai, stats]);

  // monthly: adoption that month and first-time users
  const monthRows = useMemo(() => {
    const months = monthsIn(scope);
    return ai.monthly.map((m, i) => {
      const key = months[i]?.key;
      const present = new Set(scope.daily.filter((d) => d.present && d.date.startsWith(key ?? '')).map((d) => d.employeeId)).size;
      const firstTime = [...aiByPerson.first.values()].filter((f) => f === key).length;
      return { ...m, present, adoption: present ? (m.users / present) * 100 : 0, perUser: m.users ? m.hours / m.users : 0, firstTime: i === 0 ? null : firstTime };
    });
  }, [ai, scope, aiByPerson]);

  const insights = rulesFor('ai');

  const donut = [
    { name: 'Used an AI tool', value: ai.adopters, color: CHART.ai },
    { name: 'No AI tool use found', value: ai.people - ai.adopters, color: CHART.missing },
  ];


  /* ------------------------------ charts (tab + detail pages) ------------------------------ */
  const toolsChart = (h: number) => (
    <ResponsiveContainer width="100%" height={h}>
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
        <Bar dataKey="users" name="Users" fill={CHART.ai} radius={[0, 3, 3, 0]} label={{ position: 'right', fill: CHART.axis, fontSize: 12 }}
          cursor={detail === 'tools' ? 'pointer' : undefined}
          onClick={(d: { tool?: string; payload?: { tool?: string } }) => { if (detail === 'tools') setToolPick(d?.payload?.tool ?? d?.tool ?? 'all'); }} />
      </BarChart>
    </ResponsiveContainer>
  );
  const trendChart = (h: number) => (
    <ResponsiveContainer width="100%" height={h}>
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
  );
  const powerChart = (list: typeof ranked) => (list.length ? (
    <ResponsiveContainer width="100%" height={Math.max(240, list.length * 30 + 30)}>
      <BarChart data={list.map((p) => ({ id: p.emp.id, name: p.emp.name, dept: p.emp.department, tools: [...p.aiTools].join(', '), hours: +p.aiHrs.toFixed(1) }))}
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
              <span className="click-hint">Click to open their AI use</span>
            </div>
          );
        }} />
        <Bar dataKey="hours" fill={CHART.ai} radius={[0, 3, 3, 0]} cursor="pointer"
          onClick={(d: { id?: string; payload?: { id?: string } }) => { const pid = d?.payload?.id ?? d?.id; if (pid) openDetail(`person:${pid}`, 'power'); }} label={{ position: 'right', fill: CHART.axis, fontSize: 12, formatter: (v: number) => `${v}h` }} />
      </BarChart>
    </ResponsiveContainer>
  ) : <p className="empty">Nobody matches this filter.</p>);

  const avgFilter = (
    <div className="threshold" role="group" aria-label="Filter by total AI use">
      <span className="threshold-prefix">Total AI use</span>
      <Select label="Comparison" value={totOp} onChange={setTotOp} options={[{ value: '>', label: 'greater than' }, { value: '<', label: 'less than' }]} />
      <NumberField label="Total AI hours in the period" value={totVal} step={0.5} min={0} suffix="h" onChange={(v) => setTotVal(Math.max(0, +v.toFixed(2)))} />
    </div>
  );
  const filterNote = `${fmtN(filtered.length)} of ${fmtN(ranked.length)} AI users have ${totOp === '>' ? 'more' : 'less'} than ${totVal}h of AI use in total in the period.`;

  /* ------------------------------ detail pages ------------------------------ */
  if (detail === 'tools') {
    const toolFilter = (
      <Select label="Tool" value={toolPick} onChange={setToolPick}
        options={[{ value: 'all', label: `All tools (${ai.byTool.length})` }, ...ai.byTool.map((t) => ({ value: t.tool, label: `${t.tool} (${t.users})` }))]} />
    );
    const tRow = toolRows.find((t) => t.tool === toolPick);
    if (toolPick !== 'all' && tRow) {
      const users = stats.filter((p) => p.aiTools.has(toolPick)).map((p) => {
        const h = aiByPerson.tools.get(p.emp.id)?.get(toolPick) ?? 0;
        return { p, h, share: p.aiHrs ? (h / p.aiHrs) * 100 : 0 };
      });
      const byTeam = new Map<string, { users: number; hours: number }>();
      users.forEach(({ p, h }) => { const x = byTeam.get(p.emp.department) ?? { users: 0, hours: 0 }; x.users++; x.hours += h; byTeam.set(p.emp.department, x); });
      const teamRows = [...byTeam.entries()].map(([name, v]) => ({ name, ...v, hours: +v.hours.toFixed(2) })).sort((x, y) => y.users - x.users);
      return (
        <>
          <DetailHeader title={toolPick} lede={`Everyone who used ${toolPick} in the selected period.`} extraFilters={toolFilter} />
          <div className="grid">
            <Section title={`${toolPick} at a glance`}>
              <div className="stat-row">
                <Stat value={fmtN(tRow.users)} label={`users · ${fmtPct(tRow.pct)} of people`} />
                <Stat value={`${tRow.hours.toFixed(1)} h`} label="total time on the tool" />
                <Stat value={`${tRow.perUser.toFixed(2)} h`} label="per user in the period" />
                <Stat value={fmtPct(tRow.share)} label="of all AI time" />
              </div>
            </Section>
            <Section title={`Users by ${org.d}`}>
              <ResponsiveContainer width="100%" height={Math.max(220, teamRows.length * 28 + 40)}>
                <BarChart data={teamRows} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }} maxBarSize={24}>
                  <CartesianGrid stroke={CHART.grid} horizontal={false} />
                  <XAxis type="number" {...axisProps} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" {...axisProps} width={150} interval={0} />
                  <Tooltip formatter={(v: number) => [`${v} users`, 'Users']} cursor={{ fill: 'rgba(229, 223, 255, .35)' }} />
                  <Bar dataKey="users" fill={CHART.ai} radius={[0, 3, 3, 0]} label={{ position: 'right', fill: CHART.axis, fontSize: 12 }} />
                </BarChart>
              </ResponsiveContainer>
            </Section>
            <Section title={`All ${fmtN(users.length)} ${toolPick} users`} note="Select a row to open that person's AI use.">
              <DataTable rows={users} max={25} initialSort={{ key: 'h', dir: 'desc' }}
                onRowClick={(r) => openDetail(`person:${r.p.emp.id}`, 'tools')} rowTitle={(r) => `Open ${r.p.emp.name}`}
                cols={[
                  { key: 'name', label: 'Name', get: (r) => r.p.emp.name },
                  { key: 'team', label: org.D, get: (r) => r.p.emp.department },
                  { key: 'h', label: `Hours on ${toolPick}`, align: 'right', get: (r) => r.h, render: (r) => <b>{r.h.toFixed(2)}</b> },
                  { key: 'share', label: 'Share of their AI time', align: 'right', get: (r) => r.share, render: (r) => fmtPct(r.share) },
                  { key: 'ai', label: 'All AI hours', align: 'right', get: (r) => r.p.aiHrs, render: (r) => r.p.aiHrs.toFixed(1) },
                ]} />
            </Section>
          </div>
        </>
      );
    }
    return (
      <>
        <DetailHeader title="Users by tool" lede={`Who uses each AI tool and how much, for the selected period. ${fmtN(ai.adopters)} of ${fmtN(ai.people)} people used at least one. Pick a tool to see its users.`} extraFilters={toolFilter} />
        <div className="grid">
          <Section title="Users by tool" note="Select a tool bar or row to see its users.">{toolsChart(Math.max(260, ai.byTool.length * 30))}</Section>
          <Section title={`All ${ai.byTool.length} tools`} note="A person counts once per tool. Share of AI time = the tool's hours ÷ all AI hours.">
            <DataTable rows={toolRows} initialSort={{ key: 'users', dir: 'desc' }} onRowClick={(r) => setToolPick(r.tool)} rowTitle={(r) => `Show ${r.tool} users`} cols={[
              { key: 'tool', label: 'Tool', get: (r) => r.tool },
              { key: 'users', label: 'Users', align: 'right', get: (r) => r.users },
              { key: 'pct', label: '% of people', align: 'right', get: (r) => r.pct, render: (r) => fmtPct(r.pct) },
              { key: 'hours', label: 'Total hours', align: 'right', get: (r) => r.hours, render: (r) => r.hours.toFixed(1) },
              { key: 'perUser', label: 'Hours per user', align: 'right', get: (r) => r.perUser, render: (r) => r.perUser.toFixed(2) },
              { key: 'share', label: 'Share of AI time', align: 'right', get: (r) => r.share, render: (r) => fmtPct(r.share) },
              { key: 'lead', label: 'Most users in', get: (r) => r.lead },
            ]} />
          </Section>
        </div>
      </>
    );
  }
  if (detail === 'trend') return (
    <>
      <DetailHeader title="Monthly AI-tool usage" lede="AI hours and distinct users per month, with adoption among people present that month." />
      <div className="grid">
        <Section title="Trend" note="* marks a month only partly inside the selected period.">{trendChart(320)}</Section>
        <Section title="By month" note="Adoption = distinct AI users ÷ people present that month. First-time users = people whose first AI use in the period was that month.">
          <DataTable rows={monthRows} cols={[
            { key: 'month', label: 'Month', get: (r) => r.month },
            { key: 'hours', label: 'AI hours', align: 'right', get: (r) => r.hours, render: (r) => r.hours.toFixed(1) },
            { key: 'users', label: 'Distinct users', align: 'right', get: (r) => r.users },
            { key: 'present', label: 'People present', align: 'right', get: (r) => r.present },
            { key: 'adoption', label: 'Adoption', align: 'right', get: (r) => r.adoption, render: (r) => fmtPct(r.adoption) },
            { key: 'perUser', label: 'Hours per user', align: 'right', get: (r) => r.perUser, render: (r) => r.perUser.toFixed(2) },
            { key: 'first', label: 'First-time users', align: 'right', get: (r) => r.firstTime ?? -1, render: (r) => (r.firstTime === null ? <span className="muted">–</span> : r.firstTime) },
          ]} />
        </Section>
      </div>
    </>
  );
  if (detail === 'power') {
    const userFilter = (
      <Select label="User" value={userPick} onChange={setUserPick}
        options={[{ value: 'all', label: `All users (${filtered.length})` }, ...filtered.map((p) => ({ value: p.emp.id, label: p.emp.name }))]} />
    );
    const picked = userPick === 'all' ? null : filtered.find((p) => p.emp.id === userPick) ?? null;
    const shown = picked ? [picked] : filtered;
    return (
      <>
        <DetailHeader title="AI power users" filters="period" extraFilters={userFilter}
          lede={picked ? `${picked.emp.name} · #${ranked.indexOf(picked) + 1} of ${fmtN(ranked.length)} AI users.` : `AI users ranked by total AI-assistant hours in the period. ${filterNote}`}>
          {picked && <button className="detail-link" onClick={() => openDetail(`person:${picked.emp.id}`, 'power')}>Open {picked.emp.name}'s AI use ›</button>}
        </DetailHeader>
        <div className="grid">
          <Section title={picked ? picked.emp.name : `Top ${Math.min(powerN, filtered.length)}`}
            tools={!picked && <>{avgFilter}<span className="ctl-label">Show top</span><NumberField label="Number of power users" value={powerN} step={1} min={1} onChange={(v) => setPowerN(Math.max(1, Math.round(v)))} /></>}>
            {powerChart(picked ? [picked] : power)}
          </Section>
          <Section title={picked ? 'Details' : `All ${fmtN(filtered.length)} matching AI users`} note="Select a row to open that person's AI use.">
            <DataTable rows={shown} max={50} initialSort={{ key: 'h', dir: 'desc' }}
              onRowClick={(r) => openDetail(`person:${r.emp.id}`, 'power')} rowTitle={(r) => `Open ${r.emp.name}`}
              cols={[
                { key: 'rank', label: '#', get: (r) => ranked.indexOf(r) + 1 },
                { key: 'name', label: 'Name', get: (r) => r.emp.name },
                { key: 'team', label: org.D, get: (r) => r.emp.department },
                { key: 'h', label: 'AI hours', align: 'right', get: (r) => r.aiHrs, render: (r) => <b>{r.aiHrs.toFixed(1)}</b> },
                { key: 'avg', label: 'Avg / present day', align: 'right', get: avgUse, render: (r) => `${Math.round(avgUse(r) * 60)} min` },
                { key: 'tools', label: 'Tools', align: 'right', get: (r) => r.aiTools.size },
                { key: 'top', label: 'Top tool', get: (r) => topTool(r.emp.id) },
                { key: 'days', label: 'Present days', align: 'right', get: (r) => r.presentDays },
              ]} />
          </Section>
        </div>
      </>
    );
  }

  // a power user's own page
  if (detail?.startsWith('person:')) {
    const i = ranked.findIndex((p) => `person:${p.emp.id}` === detail);
    if (i >= 0) return <PersonAiDetail person={ranked[i]} rank={i + 1} adopters={ranked.length} />;
  }

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

        <Section id="tools" span={7} title="Users by tool" onOpen={() => openDetail('tools', 'tools')} note="A person counts once per tool they used in the period.">
          {toolsChart(Math.max(240, ai.byTool.length * 26))}
        </Section>

        <Section id="nonai" title="People with no AI use"
          note={`${fmtN(nonAi.length)} of ${fmtN(ai.people)} people show no AI-assistant use in this period. Listed: the ${fmtN(nonAiList.length)} with ${cfg.minPresentDaysForLists}+ present days, lowest active time first.`}>
          <DataTable rows={nonAiList} max={10} initialSort={{ key: 'v', dir: 'asc' }} cols={[
            { key: 'name', label: 'Name', get: (r) => r.emp.name },
            { key: 'dept', label: org.D, get: (r) => r.emp.department },
            { key: 'v', label: 'Avg active', align: 'right', get: (r) => r.avg.active, render: (r) => fmtH(r.avg.active, 2) },
            { key: 'o', label: 'Avg online', align: 'right', get: (r) => r.avg.online, render: (r) => fmtH(r.avg.online, 2) },
            { key: 'd', label: 'Days', align: 'right', get: (r) => r.presentDays },
          ]} />
        </Section>

        <Section id="trend" title="Monthly AI-tool usage" onOpen={() => openDetail('trend', 'trend')} note="* marks a month only partly inside the selected period.">
          {trendChart(280)}
        </Section>
        <Section id="power" title="AI power users" onOpen={() => openDetail('power', 'power')}
          tools={<>{avgFilter}<span className="ctl-label">Show top</span><NumberField label="Number of power users" value={powerN} step={1} min={1} onChange={(v) => setPowerN(Math.max(1, Math.round(v)))} /></>}
          note={`Total AI-assistant hours in the period. ${filterNote} Hover a bar for ${org.d} and tools used; click it to open that person.`}>
          {powerChart(power)}
        </Section>

      </div>
    </>
  );
}
