import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ALL_CATEGORIES, ALL_TEAMS, useDash } from '../state';
import { warmPalette } from '../theme/tokens';
import {
  axisProps, CHART, DataTable, DetailHeader, InsightPanel, NumberField, PageHeader, Section, Select, Stat,
} from '../components/ui';
import { fmtN, fmtPct, nonWork, personStats, topItems, usageTotals, type PersonStat } from '../lib/metrics';
import { misTagCandidates } from '../lib/insights';

type Kind = 'all' | 'app' | 'url';
type Item = ReturnType<typeof topItems>[number];
const P_COLOR: Record<string, string> = { productive: CHART.productive, neutral: CHART.neutral, unproductive: CHART.unproductive };
const CAT_COLORS = warmPalette;

export function AppsPage() {
  const { ds, scope: baseSc, stats: basePeople, detail, openDetail, team, teamLabel, category, setCategory, rulesFor } = useDash();
  const catOn = category !== ALL_CATEGORIES;
  // category filter: every number on this page is recomputed on that category's usage only
  const sc = useMemo(() => (catOn ? { ...baseSc, usage: baseSc.usage.filter((u) => u.category === category) } : baseSc), [baseSc, category, catOn]);
  const people = useMemo(() => (catOn ? personStats(sc).filter((p) => p.nonWorkHrs > 0 || p.unproductiveHrs > 0 || p.catHrs[category]) : basePeople), [sc, basePeople, catOn, category]);
  const scopeLabel = catOn ? `${category} · ${teamLabel}` : teamLabel;
  const cfg = ds.config;
  const [topN, setTopN] = useState(12);
  const [topKind, setTopKind] = useState<Kind>('all');
  const [urlKind, setUrlKind] = useState<Kind>('url');
  const [heavyCut, setHeavyCut] = useState(10);
  const [showNames, setShowNames] = useState(false);

  const kind = (k: Kind) => (k === 'all' ? undefined : k);
  const top = useMemo(() => topItems(sc, { n: topN, kind: kind(topKind), exclude: cfg.excludeFromTopApps }), [sc, topN, topKind, cfg]);
  const prod = useMemo(() => topItems(sc, { n: 10, kind: kind(urlKind), productivity: 'productive' }), [sc, urlKind]);
  const unprod = useMemo(() => topItems(sc, { n: 10, kind: kind(urlKind), productivity: 'unproductive' }), [sc, urlKind]);
  const unprodAll = useMemo(() => topItems(sc, { n: 20, productivity: 'unproductive' }), [sc]);
  const totals = useMemo(() => usageTotals(sc), [sc]);
  const allTotals = useMemo(() => usageTotals(baseSc), [baseSc]);
  // when a category is selected, shares are against ALL tracked app time, and people against everyone
  const shareOfAll = catOn && allTotals.total ? (totals.total / allTotals.total) * 100 : 0;
  const nw = useMemo(() => nonWork(sc, people, heavyCut), [sc, people, heavyCut]);
  const nwAll = useMemo(() => (catOn ? nonWork(baseSc, basePeople, heavyCut) : nw), [catOn, baseSc, basePeople, heavyCut, nw]);
  /** same warm colour for a category everywhere on this tab */
  const catColor = (c: string) => CAT_COLORS[Math.max(0, cfg.nonWorkCategories.indexOf(c)) % CAT_COLORS.length];
  const pickCategory = (c: string) => setCategory(category === c ? ALL_CATEGORIES : c);
  // Recharts passes the clicked tick ({ value }) to axis onClick, though its types say MouseEvent
  const axisClick = ((t: { value?: string }) => { if (t?.value) pickCategory(t.value); }) as unknown as React.MouseEventHandler<SVGElement>;
  const cands = misTagCandidates(unprodAll, cfg.nonWorkCategories, team === ALL_TEAMS ? 3 : 2);
  const candSet = new Set(cands.map((c) => c.name));

  const filterChip = catOn && (
    <button className="filter-chip" onClick={() => setCategory(ALL_CATEGORIES)} aria-label={`Clear ${category} filter`}>
      Showing {category} <span aria-hidden>✕</span>
    </button>
  );

  /* ------------------------------ charts ------------------------------ */
  const categoryChart = (h: number, horizontal = false) => (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={nwAll.categories} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 20, right: horizontal ? 40 : 10, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={CHART.grid} vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? <>
          <XAxis type="number" {...axisProps} unit="h" />
          <YAxis type="category" dataKey="category" {...axisProps} width={120} interval={0} cursor="pointer" onClick={axisClick} />
        </> : <>
          <XAxis dataKey="category" {...axisProps} interval={0} tick={{ fill: CHART.axis, fontSize: 11 }} cursor="pointer" onClick={axisClick} />
          <YAxis {...axisProps} unit="h" />
        </>}
        <Tooltip cursor={{ fill: 'rgba(229, 223, 255, .35)' }} formatter={(v: number, _n, p) => [`${v.toFixed(1)} h · ${p.payload.people} people`, 'Non-work time']} />
        <Bar dataKey="hours" fill={CHART.nonWork} radius={[3, 3, 0, 0]} cursor="pointer"
          onClick={(d: { category: string }, _i: number, e: React.MouseEvent) => { e?.stopPropagation?.(); pickCategory(d.category); }} label={{ position: horizontal ? 'right' : 'top', fill: CHART.axis, fontSize: 12, formatter: (v: number) => v.toFixed(1) }}>
          {nwAll.categories.map((c) => <Cell key={c.category} fill={catColor(c.category)} fillOpacity={catOn && c.category !== category ? 0.3 : 1} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
  const nonWorkStats = (
    <div className="stat-row">
      <Stat value={fmtPct(catOn ? shareOfAll : nw.sharePct, 2)} label={catOn ? `of all tracked app time (${fmtN(totals.total)} h of ${fmtN(allTotals.total)}) is ${category}` : `of tracked app time (${fmtN(nw.total)} h of ${fmtN(totals.total)})`} />
      <Stat value={`${fmtN(nw.touched)} / ${fmtN(basePeople.length)}`} label={catOn ? `people used ${category}` : 'people touched any of these'} />
      <Stat value={fmtN(nw.heavy)} label={`people over ${heavyCut} h in the period`} />
      <Stat value={fmtPct(nw.top3Pct)} label="of the total comes from the top 3 people" />
    </div>
  );
  const personLabel = (p: PersonStat) => (showNames ? p.emp.name : p.emp.id);
  const peopleByCatChart = () => {
    const rows = nw.people.slice(0, 15).map((p) => ({ name: personLabel(p), ...Object.fromEntries(cfg.nonWorkCategories.map((c) => [c, +(p.nonWorkByCat[c] ?? 0).toFixed(1)])) }));
    if (!rows.length) return <p className="empty">Nobody touched these categories.</p>;
    return (
      <ResponsiveContainer width="100%" height={Math.max(240, rows.length * 26 + 60)}>
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART.grid} horizontal={false} />
          <XAxis type="number" {...axisProps} unit="h" />
          <YAxis type="category" dataKey="name" {...axisProps} width={160} interval={0} />
          <Tooltip formatter={(v: number) => `${v} h`} />
          <Legend verticalAlign="top" height={30} />
          {cfg.nonWorkCategories.map((c) => <Bar key={c} dataKey={c} stackId="n" fill={catColor(c)} />)}
        </BarChart>
      </ResponsiveContainer>
    );
  };
  const itemChart = (items: Item[], color: string, markCands: boolean) => {
    if (!items.length) return <p className="empty">No items in this view.</p>;
    return (
      <ResponsiveContainer width="100%" height={Math.max(240, items.length * 28 + 20)}>
        <BarChart data={items.map((i) => ({ ...i, hours: +i.hours.toFixed(1) }))} layout="vertical" margin={{ top: 0, right: 60, bottom: 0, left: 0 }} maxBarSize={26}>
          <CartesianGrid stroke={CHART.grid} horizontal={false} />
          <XAxis type="number" {...axisProps} tickFormatter={(v: number) => fmtN(v)} />
          <YAxis type="category" dataKey="name" {...axisProps} width={220} interval={0} tick={{ fill: CHART.axis, fontSize: 11 }} />
          <Tooltip formatter={(v: number, _n, p) => [`${fmtN(v)} h · ${p.payload.people} people`, 'Active time']} />
          <Bar dataKey="hours" radius={[0, 3, 3, 0]} label={{ position: 'right', fill: CHART.axis, fontSize: 11, formatter: (v: number) => fmtN(v) }}>
            {items.map((i) => <Cell key={i.name} fill={markCands && candSet.has(i.name) ? CHART.misTag : color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  };
  const kindSelect = <Select label="Item type" value={urlKind} onChange={setUrlKind} options={[{ value: 'url', label: 'Websites' }, { value: 'app', label: 'Apps' }, { value: 'all', label: 'Apps & websites' }]} />;
  const itemCols = (unp: boolean) => [
    { key: 'name', label: 'Domain', get: (r: Item) => r.name, render: (r: Item) => <>{r.name}{unp && candSet.has(r.name) && <span className="chip warn">Check tag</span>}</> },
    { key: 'cat', label: 'Category', get: (r: Item) => r.category },
    { key: 'p', label: 'People', align: 'right' as const, get: (r: Item) => r.people },
    { key: 'h', label: 'Hours', align: 'right' as const, get: (r: Item) => r.hours, render: (r: Item) => r.hours.toFixed(1) },
  ];

  /* ------------------------------ detail views ------------------------------ */
  if (detail === 'nonwork') return (
    <>
      <DetailHeader title="Non-work activity screening" lede={`Social, video, gaming, gambling and adult sites or apps for ${scopeLabel}. Select a bar to filter.`}>{filterChip}</DetailHeader>
      <div className="grid">
        <Section title="Summary">{nonWorkStats}</Section>
        <Section span={5} title="Hours by category">{categoryChart(300, true)}</Section>
        <Section span={7} title="Top 15 people by non-work hours"
          tools={<label className="toggle"><input type="checkbox" checked={showNames} onChange={(e) => setShowNames(e.target.checked)} /> Show names</label>}>
          {peopleByCatChart()}
        </Section>
        <Section title={`All ${fmtN(nw.touched)} people who touched these categories`}
          tools={<><span className="ctl-label">Heavy user above</span><NumberField label="Heavy user hours" value={heavyCut} step={1} suffix="h" onChange={setHeavyCut} /></>}
          note="Rows above the heavy-user line are highlighted. Handle sensitive categories privately under the acceptable-use policy.">
          <DataTable rows={nw.people} max={50} initialSort={{ key: 'h', dir: 'desc' }} rowClass={(r) => (r.nonWorkHrs > heavyCut ? 'row-bad' : '')} cols={[
            { key: 'name', label: 'Person', get: (r) => personLabel(r) },
            { key: 'dept', label: 'Department', get: (r) => r.emp.department },
            { key: 'team', label: 'Team', get: (r) => r.emp.team },
            ...cfg.nonWorkCategories.map((c) => ({ key: c, label: c, align: 'right' as const, get: (r: PersonStat) => r.nonWorkByCat[c] ?? 0, render: (r: PersonStat) => (r.nonWorkByCat[c] ? r.nonWorkByCat[c].toFixed(1) : '–') })),
            { key: 'h', label: 'Total hrs', align: 'right', get: (r) => r.nonWorkHrs, render: (r) => <b>{r.nonWorkHrs.toFixed(1)}</b> },
          ]} />
        </Section>
      </div>
    </>
  );
  if (detail === 'urls') return (
    <>
      <DetailHeader title="Top 10 productive & unproductive" lede={`Ranked by active hours for ${scopeLabel}.`}>{filterChip}</DetailHeader>
      <div className="grid">
        <Section span={6} title="Productive" tools={kindSelect}>{itemChart(prod, CHART.productive, false)}</Section>
        <Section span={6} title="Unproductive" note="Amber bars are likely work tools tagged unproductive.">{itemChart(unprod, CHART.unproductive, true)}</Section>
        <Section span={6} title="Productive - table"><DataTable rows={prod} cols={itemCols(false)} initialSort={{ key: 'h', dir: 'desc' }} /></Section>
        <Section span={6} title="Unproductive - table"><DataTable rows={unprod} cols={itemCols(true)} initialSort={{ key: 'h', dir: 'desc' }} /></Section>
      </div>
    </>
  );

  /* ------------------------------ summary ------------------------------ */
  const insights = rulesFor('apps');

  return (
    <>
      <PageHeader title="Apps & websites" lede="Where active time actually goes, what is tagged productive or not, and how much is non-work.">{filterChip}</PageHeader>
      <InsightPanel items={insights} />
      <div className="grid">
        <Section id="screening" title="Non-work activity screening" onOpen={() => openDetail('nonwork', 'screening')} wholeCardOpens
          note={`Categories screened: ${cfg.nonWorkCategories.join(', ')}. Select a bar or category to filter the whole page; select the card to see who.`}>
          {nonWorkStats}
          <div onClick={(e) => e.stopPropagation()}>{categoryChart(220)}</div>
        </Section>

        <Section id="top" title="What people are actually doing"
          tools={<>
            <Select label="Item type" value={topKind} onChange={setTopKind} options={[{ value: 'all', label: 'Apps & websites' }, { value: 'app', label: 'Apps only' }, { value: 'url', label: 'Websites only' }]} />
            <Select label="How many" value={String(topN)} onChange={(v) => setTopN(Number(v))} options={['10', '12', '15', '20'].map((v) => ({ value: v, label: `Top ${v}` }))} />
          </>}
          note={`Total active hours for ${scopeLabel}. Excluded as generic: ${cfg.excludeFromTopApps.join(', ')}. Colour shows the client's productivity tag.`}>
          <div className="legend-inline">
            {Object.entries(P_COLOR).map(([k, c]) => <span key={k} className="legend-dot"><i style={{ background: c }} />{k[0].toUpperCase() + k.slice(1)}</span>)}
          </div>
          <ResponsiveContainer width="100%" height={Math.max(280, top.length * 28)}>
            <BarChart data={top} layout="vertical" margin={{ top: 0, right: 60, bottom: 0, left: 0 }} maxBarSize={26}>
              <CartesianGrid stroke={CHART.grid} horizontal={false} />
              <XAxis type="number" {...axisProps} tickFormatter={(v: number) => fmtN(v)} />
              <YAxis type="category" dataKey="name" {...axisProps} width={240} interval={0} />
              <Tooltip formatter={(v: number) => `${fmtN(v)} h`} />
              <Bar dataKey="hours" name="Active hours" radius={[0, 3, 3, 0]} label={{ position: 'right', fill: CHART.axis, fontSize: 12, formatter: (v: number) => fmtN(v) }}>
                {top.map((x) => <Cell key={x.name} fill={P_COLOR[x.productivity]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Section>

        <Section id="urls" title="Top 10 productive & unproductive" tools={kindSelect} onOpen={() => openDetail('urls', 'urls')}
          note="Amber bars on the unproductive side are items several people use for work - usually a work tool tagged wrongly.">
          <div className="split">
            <div><h3 className="sub good">Productive</h3>{itemChart(prod, CHART.productive, false)}</div>
            <div><h3 className="sub bad">Unproductive</h3>{itemChart(unprod, CHART.unproductive, true)}</div>
          </div>
        </Section>
      </div>
    </>
  );
}
