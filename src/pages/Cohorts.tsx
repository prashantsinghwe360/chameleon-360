import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useDash } from '../state';
import {
  axisProps, CHART, DataTable, DetailHeader, InsightPanel, METRIC_OPTIONS, NumberField, PageHeader, Section, Select, seriesPalette, Stat,
  type Col,
} from '../components/ui';
import {
  bandOrder, cohortCounts, cohortMeasureLabel, cohortMembers, cohortTable, cohortText, cohortValue, COHORT_MEASURES, fmtH, fmtN, fmtPct,
  METRIC_LABEL, ruleText, type CohortBy, type PersonStat,
} from '../lib/metrics';
import { family } from '../theme/tokens';
import { PEOPLE_DETAILS, PeopleSections } from './People';
import type { CohortDef, CohortMeasure, CohortRule, MetricKey } from '../types';

const SWATCHES = [family.coralRed.base, family.amber.base, family.brinkRed.base, family.tealGreen.base, family.lavender.base, family.cyan.base, family.blue.base, family.magenta.base, family.orange.base, family.green.base];
const MODE_OPTIONS = [{ value: 'min', label: 'at least' }, { value: 'max', label: 'at most' }, { value: 'range', label: 'between' }] as const;
const uid = () => `x${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const idle = (p: PersonStat) => Math.max(0, p.avg.online - p.avg.active);

export function CohortsPage() {
  const { ds, scope, stats, cohorts, setCohorts, detail, openDetail, rulesFor, teamLabel } = useDash();
  const cfg = ds.config;
  const [draft, setDraft] = useState<CohortDef | null>(null);

  /** categories a rule can target: everything tagged unproductive, plus the screened non-work categories */
  const categories = useMemo(() => {
    const set = new Set<string>(cfg.nonWorkCategories);
    scope.usage.forEach((u) => { if (u.productivity === 'unproductive') set.add(u.category); });
    return [...set].sort();
  }, [scope, cfg]);

  const members = useMemo(() => new Map(cohorts.map((c) => [c.id, cohortMembers(stats, c)])), [cohorts, stats]);
  const draftMembers = useMemo(() => (draft ? cohortMembers(stats, draft) : []), [draft, stats]);
  const total = Math.max(1, stats.length);



  /* ------------------------------ people detail pages ------------------------------ */
  if (detail && PEOPLE_DETAILS.includes(detail)) return <PeopleSections />;

  /* ------------------------------ cohort member detail ------------------------------ */
  if (detail?.startsWith('cohort:')) {
    const c = cohorts.find((x) => `cohort:${x.id}` === detail);
    if (c) return <CohortDetail c={c} list={members.get(c.id) ?? []} total={total} onEdit={() => setDraft(structuredClone(c))} />;
  }

  /* ------------------------------ editing ------------------------------ */
  const save = () => {
    if (!draft) return;
    const clean = { ...draft, name: draft.name.trim() || 'Untitled cohort' };
    setCohorts(cohorts.some((c) => c.id === clean.id) ? cohorts.map((c) => (c.id === clean.id ? clean : c)) : [...cohorts, clean]);
    setDraft(null);
  };
  const newCohort = () => setDraft({
    id: uid(), name: '', color: SWATCHES[cohorts.length % SWATCHES.length], combine: 'all',
    rules: [{ id: uid(), measure: 'active', mode: 'max', max: 2 }],
  });
  const setRule = (id: string, patch: Partial<CohortRule>) => draft && setDraft({ ...draft, rules: draft.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) });

  /* ------------------------------ comparison data ------------------------------ */
  const compare = cohorts.map((c) => {
    const list = members.get(c.id) ?? [];
    const avg = (f: (p: PersonStat) => number) => (list.length ? list.reduce((a, p) => a + f(p), 0) / list.length : 0);
    return {
      id: c.id, name: c.name, color: c.color, people: list.length,
      active: +avg((p) => p.avg.active).toFixed(2), idle: +avg(idle).toFixed(2), productive: +avg((p) => p.avg.productive).toFixed(2),
    };
  });


  const insights = rulesFor('cohorts');

  return (
    <>
      <PageHeader title="Cohorts" lede="Build named groups of people from rules on time, idle time and app usage, then follow and compare them. Individual lists and red flags sit below." />
      <InsightPanel items={insights} />
      <div className="grid">
        <Section id="mine" title="Your cohorts" tools={!draft && <button className="btn btn-filled btn-s" onClick={newCohort}><Plus size={14} aria-hidden /> New cohort</button>}
          note={`People are matched on the selected period and team (${teamLabel}). Changing the period or team re-evaluates every cohort.`}>
          <div className="cohort-grid">
            {cohorts.map((c) => {
              const list = members.get(c.id) ?? [];
              return (
                <article key={c.id} className="cohort-tile" style={{ borderTopColor: c.color }}>
                  <div className="cohort-tile-head">
                    <h3>{c.name}</h3>
                    <div className="tile-actions">
                      <button className="icon-btn" aria-label={`Edit ${c.name}`} onClick={() => setDraft(structuredClone(c))}><Pencil size={14} /></button>
                      <button className="icon-btn" aria-label={`Delete ${c.name}`} onClick={() => setCohorts(cohorts.filter((x) => x.id !== c.id))}><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <p className="cohort-rule">{cohortText(c)}</p>
                  <div className="cohort-n">{fmtN(list.length)} <small>people · {fmtPct((list.length / total) * 100)}</small></div>
                  <button className="detail-link" onClick={() => openDetail(`cohort:${c.id}`, 'mine')}>View members ›</button>
                </article>
              );
            })}
            {!cohorts.length && <p className="empty">No cohorts yet. Create one to start.</p>}
          </div>

          {draft && (
            <div className="builder" id="builder">
              <div className="builder-row">
                <label className="field">
                  <span>Cohort name</span>
                  <input className="text-input" value={draft.name} placeholder="e.g. Red flag" onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                </label>
                <div className="field">
                  <span>Colour</span>
                  <div className="swatches" role="radiogroup" aria-label="Cohort colour">
                    {SWATCHES.map((s) => (
                      <button key={s} role="radio" aria-checked={draft.color === s} aria-label={s} className={`swatch ${draft.color === s ? 'on' : ''}`} style={{ background: s }} onClick={() => setDraft({ ...draft, color: s })} />
                    ))}
                  </div>
                </div>
              </div>
              <label className="field">
                <span>Description (optional)</span>
                <input className="text-input" value={draft.description ?? ''} placeholder="What this cohort means" onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </label>

              <div className="rules">
                <div className="rules-head">
                  <span>Include people who meet</span>
                  <Select label="Combine rules" value={draft.combine} onChange={(v) => setDraft({ ...draft, combine: v })}
                    options={[{ value: 'all', label: 'all rules (and)' }, { value: 'any', label: 'any rule (or)' }]} />
                </div>
                {draft.rules.map((r) => {
                  const unit = cohortMeasureLabel(r.measure).unit;
                  return (
                    <div key={r.id} className="rule">
                      <Select<CohortMeasure> label="Measure" value={r.measure} options={COHORT_MEASURES.map(({ value, label }) => ({ value, label }))}
                        onChange={(m) => setRule(r.id, { measure: m, category: m === 'category' ? r.category ?? categories[0] : undefined })} />
                      {r.measure === 'category' && (
                        <Select label="Category" value={r.category ?? categories[0]} options={categories.map((c) => ({ value: c, label: c }))} onChange={(c) => setRule(r.id, { category: c })} />
                      )}
                      <Select label="Condition" value={r.mode} options={MODE_OPTIONS.map((o) => ({ ...o }))} onChange={(mode) => setRule(r.id, { mode, min: r.min ?? 0, max: r.max ?? (mode === 'range' ? (r.min ?? 0) + 1 : 1) })} />
                      {(r.mode === 'min' || r.mode === 'range') && <NumberField label="Minimum" value={r.min ?? 0} suffix={unit} onChange={(v) => setRule(r.id, { min: v })} />}
                      {r.mode === 'range' && <span className="ctl-label">and</span>}
                      {(r.mode === 'max' || r.mode === 'range') && <NumberField label="Maximum" value={r.max ?? 0} suffix={unit} onChange={(v) => setRule(r.id, { max: v })} />}
                      <button className="icon-btn" aria-label="Remove rule" onClick={() => setDraft({ ...draft, rules: draft.rules.filter((x) => x.id !== r.id) })}><X size={14} /></button>
                    </div>
                  );
                })}
                <button className="add-rule" onClick={() => setDraft({ ...draft, rules: [...draft.rules, { id: uid(), measure: 'idle', mode: 'range', min: 4, max: 8 }] })}>
                  <Plus size={14} aria-hidden /> Add rule
                </button>
              </div>

              <div className="builder-foot">
                <span className="preview"><b style={{ color: draft.color }}>{fmtN(draftMembers.length)}</b> people match · {cohortText(draft)}</span>
                <div className="builder-actions">
                  <button className="btn btn-grey" onClick={() => setDraft(null)}>Cancel</button>
                  <button className="btn btn-filled" onClick={save} disabled={!draft.rules.length}>Save cohort</button>
                </div>
              </div>
            </div>
          )}
        </Section>

        <Section id="compare" span={6} title="People per cohort" note="A person can belong to more than one cohort.">
          {compare.length ? (
            <ResponsiveContainer width="100%" height={Math.max(220, compare.length * 40 + 40)}>
              <BarChart data={compare} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={CHART.grid} horizontal={false} />
                <XAxis type="number" {...axisProps} allowDecimals={false} />
                <YAxis type="category" dataKey="name" {...axisProps} width={150} interval={0} />
                <Tooltip formatter={(v: number) => [`${fmtN(v)} people`, 'Members']} cursor={{ fill: 'rgba(229, 223, 255, .35)' }} />
                <Bar dataKey="people" radius={[0, 3, 3, 0]} label={{ position: 'right', fill: CHART.axis, fontSize: 12 }}>
                  {compare.map((c) => <Cell key={c.id} fill={c.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="empty">No cohorts to compare.</p>}
        </Section>

        <Section span={6} title="How cohorts spend the day" note="Average hours per present day across each cohort's members. Idle = online minus active.">
          {compare.length ? (
            <ResponsiveContainer width="100%" height={Math.max(220, compare.length * 40 + 60)}>
              <BarChart data={compare} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }} barGap={2}>
                <CartesianGrid stroke={CHART.grid} horizontal={false} />
                <XAxis type="number" {...axisProps} unit="h" />
                <YAxis type="category" dataKey="name" {...axisProps} width={150} interval={0} />
                <Tooltip formatter={(v: number) => `${v}h`} cursor={{ fill: 'rgba(229, 223, 255, .35)' }} />
                <Legend verticalAlign="top" height={30} />
                <Bar dataKey="productive" name="Productive" fill={CHART.productive} radius={[0, 3, 3, 0]} />
                <Bar dataKey="active" name="Active" fill={CHART.active} radius={[0, 3, 3, 0]} />
                <Bar dataKey="idle" name="Idle" fill={CHART.idle} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="empty">No cohorts to compare.</p>}
        </Section>

        <PeopleSections />

        <BuiltinGroupings />
      </div>
    </>
  );
}

/* ====================================================================== */
/* Member detail page for one cohort                                      */
/* ====================================================================== */
function CohortDetail({ c, list, total, onEdit }: { c: CohortDef; list: PersonStat[]; total: number; onEdit: () => void }) {
  const { back, breakdown, team } = useDash();
  const perPerson = breakdown === 'person';
  // members by department, or each member's first-rule value when a single team is selected
  const firstRule = c.rules[0];
  const byDept = useMemo(() => {
    if (perPerson) return list.map((p) => ({ name: p.emp.name, people: +(firstRule ? cohortValue(p, firstRule) : p.avg.active).toFixed(2) })).sort((a, b) => b.people - a.people);
    const m = new Map<string, number>();
    list.forEach((p) => m.set(p.emp.department, (m.get(p.emp.department) ?? 0) + 1));
    return [...m.entries()].map(([name, people]) => ({ name, people })).sort((a, b) => b.people - a.people);
  }, [list, perPerson, firstRule]);
  const personUnit = firstRule ? cohortMeasureLabel(firstRule.measure).unit : 'h';
  const personMeasure = firstRule ? (firstRule.measure === 'category' ? `${firstRule.category} hrs` : cohortMeasureLabel(firstRule.measure).label) : 'Active time / day';
  const avg = (f: (p: PersonStat) => number) => (list.length ? list.reduce((a, p) => a + f(p), 0) / list.length : 0);
  const ruleCols: Col<PersonStat>[] = c.rules.map((r) => ({
    key: `rule-${r.id}`, label: r.measure === 'category' ? `${r.category} hrs` : cohortMeasureLabel(r.measure).label.replace(' (period)', ''), align: 'right',
    get: (p) => cohortValue(p, r), render: (p) => <b>{cohortValue(p, r).toFixed(r.measure === 'presentDays' ? 0 : ['active', 'productive', 'online', 'idle'].includes(r.measure) ? 2 : 1)}</b>,
  }));
  // standard context columns, skipping any a rule already shows
  const tested = new Set(c.rules.map((r) => r.measure));
  const context: [CohortMeasure, Col<PersonStat>][] = [
    ['active', { key: 'a', label: 'Active/day', align: 'right', get: (p) => p.avg.active, render: (p) => fmtH(p.avg.active, 2) }],
    ['idle', { key: 'i', label: 'Idle/day', align: 'right', get: idle, render: (p) => fmtH(idle(p), 2) }],
    ['unproductiveHrs', { key: 'u', label: 'Unproductive hrs', align: 'right', get: (p) => p.unproductiveHrs, render: (p) => p.unproductiveHrs.toFixed(1) }],
    ['presentDays', { key: 'd', label: 'Days', align: 'right', get: (p) => p.presentDays }],
  ];
  const baseCols: Col<PersonStat>[] = [
    { key: 'name', label: 'Name', get: (p) => p.emp.name },
    { key: 'dept', label: 'Department', get: (p) => p.emp.department },
    { key: 'team', label: 'Team', get: (p) => p.emp.team },
    ...ruleCols,
    ...context.filter(([m]) => !tested.has(m)).map(([, col]) => col),
  ];
  const first = c.rules[0];
  return (
    <>
      <DetailHeader title={c.name} lede={c.description ? `${c.description} · ${cohortText(c)}` : cohortText(c)}>
        <button className="btn btn-tinted btn-s" onClick={() => { onEdit(); back(); }}><Pencil size={14} aria-hidden /> Edit rules</button>
      </DetailHeader>
      <div className="grid">
        <Section title="Summary">
          <div className="stat-row">
            <Stat value={`${fmtN(list.length)}`} label={`people · ${fmtPct((list.length / total) * 100)} of tracked`} />
            <Stat value={fmtH(avg((p) => p.avg.active), 2)} label="avg active / day" />
            <Stat value={fmtH(avg(idle), 2)} label="avg idle / day" />
            <Stat value={fmtPct(avg((p) => p.productivePct), 0)} label="avg productive share" />
          </div>
          <div className="rule-chips">{c.rules.map((r) => <span key={r.id} className="chip" style={{ background: `${c.color}22`, color: 'var(--ink)' }}>{ruleText(r)}</span>)}</div>
        </Section>
        <Section title={perPerson ? `Members in ${team} · ${personMeasure}` : 'Members by department'}>
          {byDept.length ? (
            <ResponsiveContainer width="100%" height={Math.max(200, byDept.length * 26 + 40)}>
              <BarChart data={byDept} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }} maxBarSize={26}>
                <CartesianGrid stroke={CHART.grid} horizontal={false} />
                <XAxis type="number" {...axisProps} allowDecimals={perPerson} unit={perPerson && personUnit !== 'd' ? personUnit : undefined} />
                <YAxis type="category" dataKey="name" {...axisProps} width={180} interval={0} />
                <Tooltip formatter={(v: number) => (perPerson ? [`${v}${personUnit}`, personMeasure] : [`${v} people`, 'Members'])} />
                <Bar dataKey="people" fill={c.color} radius={[0, 3, 3, 0]} label={{ position: 'right', fill: CHART.axis, fontSize: 12 }} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="empty">Nobody matches these rules in this period.</p>}
        </Section>
        <Section title={`All ${fmtN(list.length)} members`} note="Bold columns are the values each rule tests.">
          <DataTable rows={list} cols={baseCols} max={50} initialSort={{ key: ruleCols[0]?.key ?? 'a', dir: first?.mode === 'max' ? 'asc' : 'desc' }} empty="Nobody matches these rules." />
        </Section>
      </div>
    </>
  );
}

/* ====================================================================== */
/* Built-in groupings (moved from Teams): people per hour range by month  */
/* ====================================================================== */
function BuiltinGroupings() {
  const { ds, scope, stats, reliable } = useDash();
  const cfg = ds.config;
  const [cohortBy, setCohortBy] = useState<CohortBy>('band');
  const [cohortMetric, setCohortMetric] = useState<MetricKey>('active');
  const [bands, setBands] = useState(cfg.defaults.bands);

  const powerCut = useMemo(() => {
    const ai = [...stats].map((s) => s.aiHrs).sort((a, b) => b - a);
    return ai[Math.min(ai.length - 1, cfg.defaults.aiPowerUserCount - 1)] ?? 1;
  }, [stats, cfg]);
  const cohort = useMemo(() => {
    const c = cohortTable(scope, reliable, cohortBy, cohortMetric, bands, powerCut);
    if (cohortBy === 'band') {
      const byName = new Map(c.rows.map((r) => [r.name, r]));
      c.rows = bandOrder(bands).map((n) => byName.get(n) ?? { name: n, people: 0, avg: 0, series: [], aiPct: 0, prodPct: 0 });
    }
    return c;
  }, [scope, reliable, cohortBy, cohortMetric, bands, powerCut]);
  const groups = cohort.rows.slice(0, 8).map((r) => r.name);
  const counts = useMemo(() => cohortCounts(scope, reliable, cohortBy, bands, powerCut, groups),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope, reliable, cohortBy, bands, powerCut, groups.join('|')]);
  const stacked = cohortBy === 'department' || cohortBy === 'join';
  const color = (name: string, i: number) => {
    if (cohortBy === 'band') return name.startsWith('Under') ? CHART.under : name.startsWith('Over') ? CHART.over : CHART.healthy;
    if (cohortBy === 'ai') return name === 'No AI use' ? CHART.missing : name === 'AI power users' ? family.lavender.dark : CHART.ai;
    return seriesPalette[i % seriesPalette.length];
  };

  return (
    <Section id="builtin" title="Built-in groupings"
      tools={<>
        <Select label="Group people by" value={cohortBy} onChange={setCohortBy} options={[
          { value: 'band', label: 'Group by activity band' },
          { value: 'ai', label: 'Group by AI usage' },
          { value: 'department', label: 'Group by department' },
          { value: 'join', label: 'Group by join month' },
        ]} />
        <Select label="Card metric" value={cohortMetric} onChange={setCohortMetric} options={METRIC_OPTIONS.map((o) => ({ ...o, label: `Cards show ${o.label.toLowerCase()}` }))} />
      </>}
      note={cohortBy === 'band'
        ? `Each bar is the number of people whose average ${METRIC_LABEL[bands.metric].toLowerCase()} time that month falls in the hour range. Cards show the whole period. People with ${cfg.minPresentDaysForLists}+ present days.`
        : `Each bar is the number of people in the group who were present that month. People with ${cfg.minPresentDaysForLists}+ present days.`}>
      {cohortBy === 'band' && (
        <div className="band-ctl">
          <span>Bands on</span>
          <Select label="Band metric" value={bands.metric} options={METRIC_OPTIONS} onChange={(m) => setBands({ ...bands, metric: m })} />
          <span>under</span><NumberField label="Low cut-off" value={bands.low} suffix="h" onChange={(v) => setBands({ ...bands, low: v })} />
          <span>healthy to</span><NumberField label="High cut-off" value={bands.high} suffix="h" onChange={(v) => setBands({ ...bands, high: v })} />
          <span>over that is overburdened</span>
        </div>
      )}
      <div className="cohort-cards">
        {cohort.rows.slice(0, 8).map((r, i) => (
          <div key={r.name} className="cohort-card" style={{ borderTopColor: color(r.name, i) }}>
            <span className="cohort-name">{r.name}</span>
            <span className="cohort-n">{fmtN(r.people)} <small>people · {fmtPct((r.people / Math.max(1, reliable.length)) * 100)}</small></span>
            <span className="cohort-meta">{fmtH(r.avg, 2)} {METRIC_LABEL[cohortMetric].toLowerCase()} · AI {fmtPct(r.aiPct)}</span>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={counts} margin={{ top: 10, right: 10, bottom: 0, left: 0 }} barGap={2} barCategoryGap="18%">
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="month" {...axisProps} />
          <YAxis {...axisProps} allowDecimals={false} label={{ value: 'People', angle: -90, position: 'insideLeft', fill: CHART.axis, fontSize: 12 }} />
          <Tooltip formatter={(v: number, n: string) => [`${fmtN(v)} people`, n]} cursor={{ fill: 'rgba(229, 223, 255, .35)' }} />
          <Legend verticalAlign="top" height={36} />
          {groups.map((g, i) => (
            <Bar key={g} dataKey={g} name={g} fill={color(g, i)} stackId={stacked ? 'c' : undefined} radius={stacked ? undefined : [3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
      {cohortBy === 'department' && cohort.rows.length > 8 && <p className="muted small">Showing the 8 largest departments.</p>}
    </Section>
  );
}
