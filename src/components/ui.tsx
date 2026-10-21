import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronRight } from 'lucide-react';
import type { Comparator, MetricKey, Threshold } from '../types';
import { METRIC_LABEL } from '../lib/metrics';
import { useDash, type PageKey } from '../state';

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

export function Section({ id, title, note, tools, children, span = 12 }: {
  id?: string; title: string; note?: ReactNode; tools?: ReactNode; children: ReactNode; span?: 4 | 5 | 6 | 7 | 8 | 12;
}) {
  return (
    <section id={id} className={`card span-${span}`}>
      <div className="card-head">
        <h2>{title}</h2>
        {tools && <div className="card-tools">{tools}</div>}
      </div>
      <div className="card-body">{children}</div>
      {note && <p className="card-note">{note}</p>}
    </section>
  );
}

/* ------------------------------ insights ------------------------------ */
export type InsightTone = 'priority' | 'opportunity' | 'maintain';
export interface Insight { tone: InsightTone; title: string; body: string; link?: { page: PageKey; anchor: string } }
const TONE_LABEL: Record<InsightTone, string> = { priority: 'Act now', opportunity: 'Opportunity', maintain: 'Keep as is' };

export function InsightPanel({ items, title = 'Decisions this page supports' }: { items: Insight[]; title?: string }) {
  const { go } = useDash();
  if (!items.length) return null;
  return (
    <section className="insights" aria-label={title}>
      <h2>{title}</h2>
      <ol>
        {items.map((it, i) => (
          <li key={i} className={`insight tone-${it.tone}`}>
            <span className="insight-tag">{TONE_LABEL[it.tone]}</span>
            <strong>{it.title}</strong>
            <p>{it.body}</p>
            {it.link && (
              <button className="insight-link" onClick={() => go(it.link!.page, it.link!.anchor)}>
                See the data <ChevronRight size={14} aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ol>
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

export const CHART = {
  navy: '#1E2761', navySoft: '#8D96C9', orange: '#E8734A', green: '#2E9E6B', red: '#C0392B', grey: '#B9BFCC', yellow: '#F5B800',
  grid: '#E4E7EF', axis: '#5B6270',
};
export const axisProps = { tick: { fill: CHART.axis, fontSize: 12 }, axisLine: { stroke: CHART.grid }, tickLine: false } as const;
