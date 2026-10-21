import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useDash } from '../state';
import { axisProps, CHART, DataTable, InsightPanel, NumberField, PageHeader, Section, Select, Stat, type Insight } from '../components/ui';
import { fmtN, fmtPct, nonWork, topItems, usageTotals } from '../lib/metrics';
import { mappingInsight, misTagCandidates, nonWorkInsight } from '../lib/insights';

type Kind = 'all' | 'app' | 'url';
const P_COLOR: Record<string, string> = { productive: CHART.green, neutral: CHART.grey, unproductive: CHART.red };

export function AppsPage() {
  const { ds, scope, stats } = useDash();
  const cfg = ds.config;
  const [topN, setTopN] = useState(12);
  const [topKind, setTopKind] = useState<Kind>('all');
  const [urlKind, setUrlKind] = useState<Kind>('url');
  const [heavyCut, setHeavyCut] = useState(10);
  const [showNames, setShowNames] = useState(false);

  const kind = (k: Kind) => (k === 'all' ? undefined : k);
  const top = useMemo(() => topItems(scope, { n: topN, kind: kind(topKind), exclude: cfg.excludeFromTopApps }), [scope, topN, topKind, cfg]);
  const prod = useMemo(() => topItems(scope, { n: 10, kind: kind(urlKind), productivity: 'productive' }), [scope, urlKind]);
  const unprod = useMemo(() => topItems(scope, { n: 10, kind: kind(urlKind), productivity: 'unproductive' }), [scope, urlKind]);
  const unprodAll = useMemo(() => topItems(scope, { n: 20, productivity: 'unproductive' }), [scope]);
  const totals = useMemo(() => usageTotals(scope), [scope]);
  const nw = useMemo(() => nonWork(scope, stats, heavyCut), [scope, stats, heavyCut]);
  const cands = misTagCandidates(unprodAll, cfg.nonWorkCategories);
  const candSet = new Set(cands.map((c) => c.name));

  const insights = [
    mappingInsight(cands),
    {
      tone: 'maintain', title: `Only ${fmtPct((totals.unproductive / Math.max(1, totals.total)) * 100, 1)} of app time is tagged unproductive`,
      body: `${fmtN(totals.unproductive)} of ${fmtN(totals.total)} tracked hours. Top time goes to ${top.slice(0, 3).map((t) => t.name).join(', ')}.`,
      link: { page: 'apps', anchor: 'top' },
    } as Insight,
    nonWorkInsight(nw.sharePct, nw.total, nw.heavy, heavyCut),
  ].filter(Boolean) as Insight[];

  const itemCols = (unp: boolean) => [
    { key: 'name', label: 'Domain', get: (r: (typeof prod)[number]) => r.name, render: (r: (typeof prod)[number]) => <>{r.name}{unp && candSet.has(r.name) && <span className="chip warn" title="Used for work by several people - check the tag">Check tag</span>}</> },
    { key: 'p', label: 'People', align: 'right' as const, get: (r: (typeof prod)[number]) => r.people },
    { key: 'h', label: 'Hours', align: 'right' as const, get: (r: (typeof prod)[number]) => r.hours, render: (r: (typeof prod)[number]) => r.hours.toFixed(1) },
  ];

  return (
    <>
      <PageHeader title="Apps & websites" lede="Where active time actually goes, what is tagged productive or not, and how much is non-work." />
      <InsightPanel items={insights} />
      <div className="grid">
        <Section id="top" title="What people are actually doing"
          tools={<>
            <Select label="Item type" value={topKind} onChange={setTopKind} options={[{ value: 'all', label: 'Apps & websites' }, { value: 'app', label: 'Apps only' }, { value: 'url', label: 'Websites only' }]} />
            <Select label="How many" value={String(topN)} onChange={(v) => setTopN(Number(v))} options={['10', '12', '15', '20'].map((v) => ({ value: v, label: `Top ${v}` }))} />
          </>}
          note={`Total active hours. Excluded as generic: ${cfg.excludeFromTopApps.join(', ')}. Colour shows the client's productivity tag.`}>
          <div className="legend-inline">
            {Object.entries(P_COLOR).map(([k, c]) => <span key={k} className="legend-dot"><i style={{ background: c }} />{k[0].toUpperCase() + k.slice(1)}</span>)}
          </div>
          <ResponsiveContainer width="100%" height={Math.max(280, top.length * 28)}>
            <BarChart data={top} layout="vertical" margin={{ top: 0, right: 60, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={CHART.grid} horizontal={false} />
              <XAxis type="number" {...axisProps} tickFormatter={(v: number) => fmtN(v)} />
              <YAxis type="category" dataKey="name" {...axisProps} width={240} />
              <Tooltip formatter={(v: number) => `${fmtN(v)} h`} />
              <Bar dataKey="hours" name="Active hours" radius={[0, 3, 3, 0]} label={{ position: 'right', fill: CHART.axis, fontSize: 12, formatter: (v: number) => fmtN(v) }}>
                {top.map((t) => <Cell key={t.name} fill={P_COLOR[t.productivity]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Section>

        <Section id="urls" title="Top 10 productive & unproductive"
          tools={<Select label="Item type" value={urlKind} onChange={setUrlKind} options={[{ value: 'url', label: 'Websites' }, { value: 'app', label: 'Apps' }, { value: 'all', label: 'Apps & websites' }]} />}
          note={'"Check tag" marks unproductive items that are not social, video, gaming, gambling or adult and are used by several people - usually a work tool tagged wrongly.'}>
          <div className="split">
            <div><h3 className="sub good">Productive</h3><DataTable rows={prod} cols={itemCols(false)} initialSort={{ key: 'h', dir: 'desc' }} /></div>
            <div><h3 className="sub bad">Unproductive</h3><DataTable rows={unprod} cols={itemCols(true)} initialSort={{ key: 'h', dir: 'desc' }} /></div>
          </div>
        </Section>

        <Section id="screening" title="Non-work activity screening"
          tools={<><span className="ctl-label">Heavy user above</span><NumberField label="Heavy user hours" value={heavyCut} step={1} suffix="h" onChange={setHeavyCut} /></>}
          note={`Categories screened: ${cfg.nonWorkCategories.join(', ')}. Names stay hidden until you choose to show them; handle sensitive categories privately under the acceptable-use policy.`}>
          <div className="screen">
            <div className="stat-row">
              <Stat value={fmtPct(nw.sharePct, 2)} label={`of tracked app time (${fmtN(nw.total)} h of ${fmtN(totals.total)})`} />
              <Stat value={`${fmtN(nw.touched)} / ${fmtN(stats.length)}`} label="people touched any of these" />
              <Stat value={fmtN(nw.heavy)} label={`people over ${heavyCut} h in the period`} />
              <Stat value={fmtPct(nw.top3Pct)} label="of the total comes from the top 3 people" />
            </div>
            <div className="split">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={nw.categories} margin={{ top: 20, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="category" {...axisProps} interval={0} tick={{ fill: CHART.axis, fontSize: 11 }} />
                  <YAxis {...axisProps} unit="h" />
                  <Tooltip formatter={(v: number) => `${v.toFixed(1)} h`} />
                  <Bar dataKey="hours" name="Hours" fill={CHART.orange} radius={[3, 3, 0, 0]} label={{ position: 'top', fill: CHART.axis, fontSize: 12, formatter: (v: number) => v.toFixed(1) }} />
                </BarChart>
              </ResponsiveContainer>
              <div>
                <label className="toggle"><input type="checkbox" checked={showNames} onChange={(e) => setShowNames(e.target.checked)} /> Show names</label>
                <DataTable rows={nw.people.filter((p) => p.nonWorkHrs > heavyCut)} empty={`Nobody exceeds ${heavyCut} h.`} initialSort={{ key: 'h', dir: 'desc' }} max={8} cols={[
                  { key: 'name', label: 'Person', get: (r) => r.emp.name, render: (r) => (showNames ? r.emp.name : `${r.emp.id}`) },
                  { key: 'dept', label: 'Department', get: (r) => r.emp.department },
                  { key: 'h', label: 'Non-work hrs', align: 'right', get: (r) => r.nonWorkHrs, render: (r) => r.nonWorkHrs.toFixed(1) },
                ]} />
              </div>
            </div>
          </div>
        </Section>
      </div>
    </>
  );
}
