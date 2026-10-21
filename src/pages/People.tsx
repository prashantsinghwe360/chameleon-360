import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useDash } from '../state';
import { DataTable, InsightPanel, NumberField, OP_OPTIONS, PageHeader, Section, Select, ThresholdControl, type Insight } from '../components/ui';
import { compare, fmtH, fmtN, fmtPct, MEASURE_LABEL, MEASURE_SHORT, measureOf, METRIC_LABEL, pctDaysMeeting, redFlags, thresholdText, topItems } from '../lib/metrics';
import { lowestPeopleInsight, misTagCandidates, redFlagInsight } from '../lib/insights';
import type { PersonMeasure, RedFlagRule } from '../types';

const MEASURES = (Object.keys(MEASURE_LABEL) as PersonMeasure[]).map((m) => ({ value: m, label: MEASURE_LABEL[m].label }));

export function PeoplePage() {
  const { ds, scope, stats, redFlag, setRedFlag } = useDash();
  const cfg = ds.config;
  const [t, setT] = useState(cfg.defaults.individualsThreshold);
  const [minDays, setMinDays] = useState(cfg.minPresentDaysForLists);
  const [showN, setShowN] = useState(15);
  const [minUnprod, setMinUnprod] = useState(20);

  const asc = t.op === '<' || t.op === '<=';
  const list = useMemo(() => stats.filter((s) => s.presentDays >= minDays && compare(s.avg[t.metric], t.op, t.value)), [stats, t, minDays]);
  const unprodPeople = useMemo(() => stats.filter((s) => s.unproductiveHrs >= minUnprod), [stats, minUnprod]);
  const cands = useMemo(() => new Set(misTagCandidates(topItems(scope, { productivity: 'unproductive', n: 30 }), cfg.nonWorkCategories).map((c) => c.name)), [scope, cfg]);
  const flags = useMemo(() => redFlags(stats, redFlag, t), [stats, redFlag, t]);
  const workToolTop = unprodPeople.filter((p) => p.topUnproductive && cands.has(p.topUnproductive)).length;

  const ruleText = redFlag.rules.filter((r) => r.enabled)
    .map((r) => `${MEASURE_LABEL[r.measure].label.toLowerCase()} ${r.op} ${r.value}${MEASURE_LABEL[r.measure].unit}`).join(redFlag.combine === 'all' ? ' and ' : ' or ');

  const insights = [
    redFlagInsight(flags.length, `${ruleText} (${redFlag.minPresentDays}+ present days)`),
    asc ? lowestPeopleInsight(list, t) : null,
    unprodPeople.length ? {
      tone: 'opportunity', title: `${workToolTop} of ${unprodPeople.length} heavy "unproductive" users are mostly on work tools`,
      body: 'For them the fix is the category mapping, not a conversation. The rest is discretionary - gaming, social, video or news.',
      link: { page: 'people', anchor: 'unproductive' },
    } as Insight : null,
  ].filter(Boolean) as Insight[];

  const updateRule = (id: string, patch: Partial<RedFlagRule>) =>
    setRedFlag({ ...redFlag, rules: redFlag.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) });

  return (
    <>
      <PageHeader title="People" lede="Individual view for supportive manager conversations. Every list is a starting point, not a conclusion." />
      <InsightPanel items={insights} />
      <div className="grid">
        <Section id="threshold" title={`People averaging ${thresholdText(t)}`}
          tools={<>
            <ThresholdControl value={t} onChange={setT} prefix="Average" />
            <span className="ctl-label">min days</span>
            <NumberField label="Minimum present days" value={minDays} step={5} onChange={(v) => setMinDays(Math.round(v))} />
            <Select label="Rows" value={String(showN)} onChange={(v) => setShowN(Number(v))} options={['10', '15', '25', '50'].map((v) => ({ value: v, label: `Top ${v}` }))} />
          </>}
          note={`${fmtN(list.length)} people in total average ${thresholdText(t)} with at least ${minDays} present days. Sorted ${asc ? 'lowest' : 'highest'} first.`}>
          <DataTable key={`${t.metric}${t.op}`} rows={list} max={showN} initialSort={{ key: t.metric, dir: asc ? 'asc' : 'desc' }} cols={[
            { key: 'name', label: 'Name', get: (r) => r.emp.name },
            { key: 'dept', label: 'Department', get: (r) => r.emp.department },
            ...(['active', 'productive', 'online'] as const).map((m) => ({
              key: m, label: `${METRIC_LABEL[m]} hrs/day`, align: 'right' as const, get: (r: (typeof list)[number]) => r.avg[m],
              render: (r: (typeof list)[number]) => (m === t.metric ? <b>{fmtH(r.avg[m], 2)}</b> : fmtH(r.avg[m], 2)),
            })),
            { key: 'd', label: 'Present days', align: 'right', get: (r) => r.presentDays },
            { key: 'pct', label: '% days meeting', align: 'right', get: (r) => pctDaysMeeting(r, t), render: (r) => fmtPct(pctDaysMeeting(r, t)) },
          ]} />
        </Section>

        <Section id="unproductive" title="Who's visiting unproductive apps & websites"
          tools={<><span className="ctl-label">At least</span><NumberField label="Minimum unproductive hours" value={minUnprod} step={5} suffix="h" onChange={setMinUnprod} /></>}
          note={'"Work tool" means the person\'s largest unproductive item is probably a mis-tagged work app (see Apps & websites).'}>
          <DataTable rows={unprodPeople} max={10} initialSort={{ key: 'u', dir: 'desc' }} cols={[
            { key: 'name', label: 'Name', get: (r) => r.emp.name },
            { key: 'dept', label: 'Department', get: (r) => r.emp.department },
            { key: 'u', label: 'Unproductive hrs', align: 'right', get: (r) => r.unproductiveHrs, render: (r) => fmtH(r.unproductiveHrs, 1) },
            { key: 'top', label: 'Largest item', get: (r) => r.topUnproductive ?? '', render: (r) => <>{r.topUnproductive}{r.topUnproductive && cands.has(r.topUnproductive) && <span className="chip warn">Work tool</span>}</> },
            { key: 'a', label: 'Avg active hrs/day', align: 'right', get: (r) => r.avg.active, render: (r) => r.avg.active.toFixed(2) },
          ]} />
        </Section>

        <Section id="redflags" title="Red-flag employees"
          note="Sustained low activity can reflect role mismatch, disengagement, a device or tracking issue, or offline work. Add rules as new metrics are agreed - every rule uses data already in the dashboard.">
          <div className="rules">
            <div className="rules-head">
              <span>Flag people with</span>
              <NumberField label="Minimum present days for red flags" value={redFlag.minPresentDays} step={5} onChange={(v) => setRedFlag({ ...redFlag, minPresentDays: Math.round(v) })} />
              <span>+ present days who meet</span>
              <Select label="Combine rules" value={redFlag.combine} onChange={(c) => setRedFlag({ ...redFlag, combine: c })}
                options={[{ value: 'all', label: 'all rules' }, { value: 'any', label: 'any rule' }]} />
            </div>
            {redFlag.rules.map((r) => (
              <div key={r.id} className={`rule ${r.enabled ? '' : 'off'}`}>
                <input type="checkbox" checked={r.enabled} aria-label="Use this rule" onChange={(e) => updateRule(r.id, { enabled: e.target.checked })} />
                <Select label="Measure" value={r.measure} options={MEASURES} onChange={(m) => updateRule(r.id, { measure: m })} />
                <Select label="Comparison" value={r.op} options={OP_OPTIONS} onChange={(op) => updateRule(r.id, { op })} />
                <NumberField label="Value" value={r.value} step={0.5} suffix={MEASURE_LABEL[r.measure].unit} onChange={(v) => updateRule(r.id, { value: v })} />
                <button className="icon-btn" aria-label="Remove rule" onClick={() => setRedFlag({ ...redFlag, rules: redFlag.rules.filter((x) => x.id !== r.id) })}><X size={14} /></button>
              </div>
            ))}
            <button className="add-rule" onClick={() => setRedFlag({ ...redFlag, rules: [...redFlag.rules, { id: `r${Date.now()}`, measure: 'avgProductive', op: '<', value: 2, enabled: true }] })}>
              <Plus size={14} aria-hidden /> Add rule
            </button>
          </div>
          {redFlag.minPresentDays > scope.range.workingDays && (
            <div className="notice">
              The selected period has only {scope.range.workingDays} working days, so nobody can reach {redFlag.minPresentDays} present days.
              <button onClick={() => setRedFlag({ ...redFlag, minPresentDays: Math.max(1, Math.round(scope.range.workingDays * 0.4)) })}>
                Use {Math.max(1, Math.round(scope.range.workingDays * 0.4))} days (40% of the period)
              </button>
            </div>
          )}
          <div className="flag-count"><b>{fmtN(flags.length)}</b> people flagged</div>
          <DataTable rows={flags} max={14} initialSort={{ key: 'a', dir: 'asc' }} empty="Nobody meets these rules." cols={[
            { key: 'name', label: 'Name', get: (r) => r.s.emp.name },
            { key: 'dept', label: 'Department', get: (r) => r.s.emp.department },
            { key: 'a', label: 'Avg active', align: 'right', get: (r) => r.s.avg.active, render: (r) => fmtH(r.s.avg.active, 2) },
            { key: 'd', label: 'Days', align: 'right', get: (r) => r.s.presentDays },
            { key: 'why', label: 'Rules hit', get: (r) => r.reasons.length, render: (r) => <span className="reasons">{r.reasons.map((m) => <span key={m} className="chip bad">{MEASURE_SHORT[m]}: {measureOf(r.s, m, t).toFixed(1)}{MEASURE_LABEL[m].unit}</span>)}</span> },
          ]} />
        </Section>
      </div>
    </>
  );
}
