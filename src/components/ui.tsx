import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, ChevronDown, ChevronRight } from 'lucide-react';
import type { Comparator, MetricKey, Threshold } from '../types';
import { METRIC_LABEL } from '../lib/metrics';
import { useDash } from '../state';
import type { Insight, InsightTone } from '../types';
import { analytics, family, seriesPalette, slate, wellness } from '../theme/tokens';

/* ------------------------------ layout ------------------------------ */
export function PageHeader({ title, lede, children }: { title: string; lede: string; children?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        <p className="lede">{lede}</p>
      </div>
      {children && <div className="page-head-tools">{children}</div>}
    </header>
  );
}

export function Section({ id, title, note, tools, children, span = 12, onOpen, wholeCardOpens }: {
  id?: string; title: string; note?: ReactNode; tools?: ReactNode; children: ReactNode; span?: 4 | 5 | 6 | 7 | 8 | 12;
  /** adds a "Show details" button that opens the full-page detail view */
  onOpen?: () => void;
  /** clicking anywhere on the card body opens the detail view too */
  wholeCardOpens?: boolean;
}) {
  const bodyProps = wholeCardOpens && onOpen ? {
    role: 'button' as const, tabIndex: 0, onClick: onOpen,
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } },
    'aria-label': `${title}: show details`,
  } : {};
  return (
    <section id={id} className={`card span-${span} ${wholeCardOpens && onOpen ? 'card-clickable' : ''}`}>
      <div className="card-head">
        <h2>{title}</h2>
        {(tools || onOpen) && (
          <div className="card-tools">
            {tools}
            {onOpen && <button className="detail-link" onClick={onOpen}>Show details <ChevronRight size={14} aria-hidden /></button>}
          </div>
        )}
      </div>
      <div className="card-body" {...bodyProps}>{children}</div>
      {note && <p className="card-note">{note}</p>}
    </section>
  );
}

/** Header for a full-page detail view, with a Back button to where the user came from. */
export function DetailHeader({ title, lede, children }: { title: string; lede?: string; children?: ReactNode }) {
  const { back, backLabel, canGoBack } = useDash();
  return (
    <>
      {canGoBack && (
        <button className="back-btn" onClick={back}><ArrowLeft size={16} aria-hidden /> Back to {backLabel}</button>
      )}
      <PageHeader title={title} lede={lede ?? ''}>{children}</PageHeader>
    </>
  );
}

/* ------------------------------ insights ------------------------------ */
export type { Insight, InsightTone } from '../types';
const TONE_LABEL: Record<InsightTone, string> = { priority: 'Act now', opportunity: 'Opportunity', maintain: 'Keep as is' };

export function InsightPanel({ items, title = 'Decisions this page supports', defaultOpen = false }: { items: Insight[]; title?: string; defaultOpen?: boolean }) {
  const { go } = useDash();
  const [open, setOpen] = useState(defaultOpen);
  if (!items.length) return null;
  const counts = (Object.keys(TONE_LABEL) as InsightTone[])
    .map((t) => ({ t, n: items.filter((i) => i.tone === t).length }))
    .filter((c) => c.n > 0);
  return (
    <section className={`insights ${open ? 'open' : ''}`} aria-label={title}>
      <button className="insights-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <h2>{title}</h2>
        {!open && (
          <>
            <span className="insights-counts">
              {counts.map((c) => <span key={c.t} className={`insight-tag tag-${c.t}`}>{c.n} {TONE_LABEL[c.t].toLowerCase()}</span>)}
            </span>
            <span className="insights-peek">{items[0].title}{items.length > 1 ? ` and ${items.length - 1} more` : ''}</span>
          </>
        )}
        <ChevronDown size={18} aria-hidden className="insights-chevron" />
      </button>
      {open && (
        <ol className="insight-rows">
          {items.map((it, i) => (
            <li key={it.id ?? i} className={`insight-row tone-${it.tone}`}>
              <span className="insight-tag">{TONE_LABEL[it.tone]}</span>
              <div className="insight-text">
                <strong>{it.title}</strong>
                <p>{it.body}</p>
              </div>
              <div className="insight-side">
                {it.metric && (
                  <div className="insight-metric">
                    <span className="insight-metric-value">{it.metric.value}</span>
                    <span className="insight-metric-label">{it.metric.label}</span>
                  </div>
                )}
                {it.link && <button className="btn-bordered" onClick={() => go(it.link!.page, it.link!.anchor)}>See evidence</button>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/* ------------------------------ controls ------------------------------ */
export function Select<T extends string>({ value, onChange, options, label }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string;
}) {
  return (
    <label className="ctl">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} aria-label={label}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function NumberField({ value, onChange, label, step = 0.5, min = 0, suffix }: {
  value: number; onChange: (n: number) => void; label: string; step?: number; min?: number; suffix?: string;
}) {
  return (
    <label className="ctl num">
      <span className="sr-only">{label}</span>
      <input type="number" value={value} step={step} min={min} aria-label={label}
        onChange={(e) => { const n = parseFloat(e.target.value); if (!Number.isNaN(n)) onChange(n); }} />
      {suffix && <span className="suffix">{suffix}</span>}
    </label>
  );
}

export const METRIC_OPTIONS: { value: MetricKey; label: string }[] =
  (Object.keys(METRIC_LABEL) as MetricKey[]).map((k) => ({ value: k, label: `${METRIC_LABEL[k]} hrs` }));
export const OP_OPTIONS: { value: Comparator; label: string }[] = [
  { value: '<', label: '<' }, { value: '<=', label: '≤' }, { value: '>', label: '>' }, { value: '>=', label: '≥' },
];

/** "[Active hrs] [<] [3] h/day" - the reusable metric + value filter. */
export function ThresholdControl({ value, onChange, prefix }: { value: Threshold; onChange: (t: Threshold) => void; prefix?: string }) {
  return (
    <div className="threshold" role="group" aria-label="Threshold">
      {prefix && <span className="threshold-prefix">{prefix}</span>}
      <Select label="Metric" value={value.metric} options={METRIC_OPTIONS} onChange={(m) => onChange({ ...value, metric: m })} />
      <Select label="Comparison" value={value.op} options={OP_OPTIONS} onChange={(op) => onChange({ ...value, op })} />
      <NumberField label="Hours per day" value={value.value} suffix="h/day" onChange={(n) => onChange({ ...value, value: n })} />
    </div>
  );
}

/* ------------------------------ KPI ------------------------------ */
export function Kpi({ value, label, sub, tone, onClick }: { value: string; label: string; sub: string; tone?: 'good' | 'bad' | 'warn'; onClick?: () => void }) {
  return (
    <button className={`kpi ${tone ? `kpi-${tone}` : ''}`} onClick={onClick}>
      <span className="kpi-value">{value}</span>
      <span className="kpi-label">{label}</span>
      <span className="kpi-sub">{sub}</span>
      <span className="kpi-go"><ChevronRight size={16} aria-hidden /></span>
    </button>
  );
}

/* ------------------------------ table ------------------------------ */
export interface Col<T> {
  key: string; label: string; align?: 'left' | 'right';
  get: (r: T) => number | string; render?: (r: T) => ReactNode;
}
export function DataTable<T>({ rows, cols, initialSort, rowClass, max, empty = 'Nobody matches this filter.' }: {
  rows: T[]; cols: Col<T>[]; initialSort?: { key: string; dir: 'asc' | 'desc' };
  rowClass?: (r: T, i: number) => string; max?: number; empty?: string;
}) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [showAll, setShowAll] = useState(false);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const c = cols.find((x) => x.key === sort.key);
    if (!c) return rows;
    return [...rows].sort((a, b) => {
      const va = c.get(a), vb = c.get(b);
      const r = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sort.dir === 'asc' ? r : -r;
    });
  }, [rows, cols, sort]);
  const visible = max && !showAll ? sorted.slice(0, max) : sorted;
  if (!rows.length) return <p className="empty">{empty}</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.key} className={c.align === 'right' ? 'r' : ''} aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <button onClick={() => setSort((s) => ({ key: c.key, dir: s?.key === c.key && s.dir === 'desc' ? 'asc' : 'desc' }))}>
                  {c.label}
                  {sort?.key === c.key && (sort.dir === 'asc' ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((r, i) => (
            <tr key={i} className={rowClass?.(r, i) ?? ''}>
              {cols.map((c) => <td key={c.key} className={c.align === 'right' ? 'r' : ''}>{c.render ? c.render(r) : c.get(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {max && rows.length > max && (
        <button className="show-all" onClick={() => setShowAll((v) => !v)}>
          {showAll ? `Show top ${max}` : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}

export function Stat({ value, label }: { value: string; label: string }) {
  return <div className="stat"><span className="stat-value">{value}</span><span className="stat-label">{label}</span></div>;
}

/** Semantic chart colours, all taken from the design tokens. */
export const CHART = {
  ...analytics,                              // working, online, active, idle, productive, unproductive, neutral, manual
  under: wellness.underutilised,             // threshold lines, under-utilised counts, red flags
  healthy: wellness.healthy,
  over: wellness.overburdened,
  ai: family.lavender.base,
  aiLine: family.cyan.base,
  present: family.green.base,
  missing: slate[200],
  misTag: family.amber.base,                 // unproductive item that is probably a work tool
  nonWork: family.brinkRed.base,
  grid: slate[100],
  axis: slate[500],
};
export { seriesPalette };
export const axisProps = { tick: { fill: CHART.axis, fontSize: 12, fontFamily: 'Lato, sans-serif' }, axisLine: { stroke: CHART.grid }, tickLine: false } as const;
