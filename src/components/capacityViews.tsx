import { useEffect, useMemo, useRef, useState } from 'react';
import type { CapacityBreakdown } from '../lib/metrics';
import { fmtN } from '../lib/metrics';
import { family, slate, wellness } from '../theme/tokens';

export type LoadStatus = 'under' | 'healthy' | 'over';
export const LOAD_COLOR: Record<LoadStatus, string> = { under: wellness.underutilised, healthy: wellness.healthy, over: wellness.overburdened };
export const LOAD_LABEL: Record<LoadStatus, string> = { under: 'Underutilised', healthy: 'Healthy', over: 'Overburdened' };

/** 157,054 -> "157.1Kh"; 812 -> "812h" */
export const fmtKh = (h: number) => (Math.abs(h) >= 1000 ? `${(h / 1000).toFixed(1)}Kh` : `${Math.round(h)}h`);
/** 5.98 -> "5h 59m" */
export const fmtHm = (h: number) => {
  const m = Math.round(Math.abs(h) * 60);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
};
const sign = (n: number) => (n < 0 ? '−' : n > 0 ? '+' : '');
const ppl = (n: number) => (Math.abs(n) >= 10 ? Math.round(Math.abs(n)).toLocaleString('en-US') : Math.abs(n).toFixed(1));

/* ====================================================================== */
/* KPI strip: average per working day, net deviation, load gap in people   */
/* ====================================================================== */
export function CapacityKpis({ b, benchmark, workingDays, metricLabel, status }: {
  b: CapacityBreakdown; benchmark: number; workingDays: number; metricLabel: string; status: (v: number) => LoadStatus;
}) {
  const personDays = b.ideal / Math.max(0.0001, benchmark);
  const avg = personDays ? b.achieved / personDays : 0;
  const gapPeople = b.deviation / (benchmark * Math.max(1, workingDays));
  const tone = LOAD_COLOR[status(avg)];
  const darkTone = status(avg) === 'healthy' ? family.tealGreen.dark : status(avg) === 'under' ? family.orange.dark : family.amber.dark;
  return (
    <div className="cap-kpis">
      <div className="cap-kpi" style={{ borderTopColor: tone }}>
        <span className="cap-kpi-label">Average per working day : benchmark</span>
        <span className="cap-kpi-value" style={{ color: darkTone }}>{fmtHm(avg)} : {benchmark}h</span>
        <span className="cap-kpi-sub">{metricLabel[0].toUpperCase() + metricLabel.slice(1)} time ÷ working days (absence counts as 0h)</span>
      </div>
      <div className="cap-kpi" style={{ borderTopColor: tone }}>
        <span className="cap-kpi-label">Net capacity deviation</span>
        <span className="cap-kpi-value" style={{ color: darkTone }}>{sign(b.deviation)}{fmtN(Math.abs(b.deviation))}h</span>
        <span className="cap-kpi-sub">Achieved minus ideal hours, incl. absence</span>
      </div>
      <div className="cap-kpi" style={{ borderTopColor: tone }}>
        <span className="cap-kpi-label">Load gap in people</span>
        <span className="cap-kpi-value" style={{ color: darkTone }}>{sign(gapPeople)}{Math.abs(gapPeople).toFixed(1)}</span>
        <span className="cap-kpi-sub">Per working day · {gapPeople < 0 ? 'spare capacity (underutilised)' : 'stretched (beyond the benchmark)'}</span>
      </div>
    </div>
  );
}

/* ====================================================================== */
/* Capacity lens: achieved vs ideal bar, and why the gap                   */
/* ====================================================================== */
export function CapacityLensView({ b, benchmark, workingDays, headcount, status }: {
  b: CapacityBreakdown; benchmark: number; workingDays: number; headcount: number; status: (v: number) => LoadStatus;
}) {
  const perHead = benchmark * Math.max(1, workingDays);
  const personDays = b.ideal / Math.max(0.0001, benchmark);
  const avg = personDays ? b.achieved / personDays : 0;
  const color = LOAD_COLOR[status(avg)];
  const scale = Math.max(b.ideal, b.achieved) || 1;
  const achievedPct = (b.achieved / scale) * 100;
  const idealPct = (b.ideal / scale) * 100;
  const gapPct = b.ideal ? (b.deviation / b.ideal) * 100 : 0;
  const gapPeople = b.deviation / perHead;
  const rows = [
    { k: 'Absence hours', h: b.absence, s: '−', color: slate[400], note: `person-days of ${benchmark}h missing · days with no tracked presence` },
    { k: 'Shortfall hours', h: b.shortfall, s: '−', color: family.amber.base, note: `person-days of ${benchmark}h short · short days while present` },
    { k: 'Extra hours', h: b.extra, s: '+', color: wellness.healthy, note: `person-days of ${benchmark}h extra · time beyond ${benchmark}h while present` },
  ];
  const rowMax = Math.max(...rows.map((r) => r.h), 1);

  // plain-language reading of where the gap comes from
  const reasons = Object.entries(b.absenceByReason).sort((x, y) => y[1] - x[1]);
  const reasonText = reasons.length > 1 || (reasons[0] && reasons[0][0] !== 'No presence signal')
    ? ` ${reasons.slice(0, 2).map(([r, h]) => `${r} is ${Math.round((h / Math.max(1, b.absence)) * 100)}%`).join(', ')} of the absence.` : '';
  let tells: string;
  if (b.extra > b.absence + b.shortfall) tells = 'Extra hours beyond the benchmark outweigh the gaps - the team is stretched. Check workload and wellbeing.';
  else if (b.absence >= 2 * b.shortfall) tells = `Most of the gap comes from days nobody was tracked, not from short days.${reasonText} Check leave records and whether the agent is running before judging workload.`;
  else if (b.shortfall >= b.absence) tells = 'Most of the gap comes from short days while people were present - a workload or engagement question rather than attendance.';
  else tells = `The gap is split between days with no presence and short days while present.${reasonText}`;

  return (
    <div className="lens2">
      <div className="lens2-head">
        <div>
          <span className="lens2-ach" style={{ color }}>Net Achieved Capacity: {fmtKh(b.achieved)}</span>
          <small>≈ {ppl(b.achieved / perHead)} people at {benchmark}h a day</small>
        </div>
        <div className="r">
          <span className="lens2-ideal">Net Ideal Capacity: {fmtKh(b.ideal)}</span>
          <small>{fmtN(headcount)} actual headcount</small>
        </div>
      </div>
      <div className="lens2-bar" role="img" aria-label={`Achieved ${fmtN(b.achieved)} hours of ${fmtN(b.ideal)} ideal`}>
        <i className="fill" style={{ width: `${achievedPct}%`, background: color }} />
        <i className="rest" style={{ left: `${Math.min(achievedPct, idealPct)}%`, width: `${Math.abs(idealPct - achievedPct)}%`, background: b.deviation < 0 ? `${color}55` : `${color}` }} />
        <b className="marker" style={{ left: `${idealPct}%` }} />
      </div>
      <div className="lens2-foot">
        <span>0h</span>
        <div className="r">
          <b style={{ color }}>Gap {sign(b.deviation)}{fmtN(Math.abs(b.deviation))}h ({sign(gapPct)}{Math.abs(gapPct).toFixed(0)}%)</b>
          <small>≈ {sign(gapPeople)}{ppl(gapPeople)} people · {b.deviation < 0 ? 'fewer' : 'more'} hours than the benchmark</small>
        </div>
      </div>

      <div className="lens2-why">
        <h3>Why the gap</h3>
        {rows.map((r) => (
          <div key={r.k} className="lens2-row">
            <span className="lens2-k">{r.k}</span>
            <span className="lens2-track"><i style={{ width: `${(r.h / rowMax) * 100}%`, background: r.color }} /></span>
            <span className="lens2-v">{r.h ? r.s : ''}{fmtKh(r.h)}</span>
            <span className="lens2-note">≈ {fmtN(r.h / Math.max(0.0001, benchmark))} {r.note}</span>
          </div>
        ))}
        <div className="lens2-tell"><b>What it tells:</b> {tells}</div>
        <p className="lens2-formula">Achieved = ideal − absence − shortfall + extra.</p>
      </div>
    </div>
  );
}

/* ====================================================================== */
/* Teams at a glance: one dot per team on a load scale                     */
/* ====================================================================== */
export interface GlanceItem { name: string; value: number; status: LoadStatus; people?: number }

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(900);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(320, e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function TeamsGlance({ items, min, max, benchmark, variancePct, unit = 'online time', onPick, pickable, noun = 'team' }: {
  items: GlanceItem[]; min: number; max: number; benchmark: number; variancePct: number; unit?: string;
  onPick?: (name: string) => void; pickable?: boolean; noun?: string;
}) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<{ it: GlanceItem; x: number; y: number } | null>(null);
  const R = 7, padX = 40, axisY = 92;
  const layout = useMemo(() => {
    const vals = items.map((i) => i.value);
    const lo = Math.floor(Math.min(min, ...vals) - 0.25);
    const hi = Math.ceil(Math.max(max, ...vals) + 0.25);
    const x = (v: number) => padX + ((v - lo) / Math.max(0.01, hi - lo)) * (width - padX * 2);
    // beeswarm: nudge dots up/down when they would overlap on the axis
    const placed: { it: GlanceItem; cx: number; cy: number }[] = [];
    for (const it of [...items].sort((a, b) => a.value - b.value)) {
      const cx = x(it.value);
      let k = 0, cy = axisY;
      const clash = (y: number) => placed.some((p) => Math.abs(p.cx - cx) < R * 2 + 2 && Math.abs(p.cy - y) < R * 2 + 1);
      while (clash(cy) && k < 12) { k++; cy = axisY + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * (R * 2 + 2); }
      placed.push({ it, cx, cy });
    }
    // labels: greedy rows below the plot, each linked to its dot by a leader line
    const rowsEnd: number[] = [];
    const labelTop = axisY + 82;
    const maxRows = 6;
    const labels = [...placed].sort((a, b) => a.cx - b.cx).map((p) => {
      const w = p.it.name.length * 6.4 + 10;
      const lx = Math.min(Math.max(p.cx, w / 2 + 2), width - w / 2 - 2);
      let row = rowsEnd.findIndex((end) => lx - w / 2 > end);
      if (row === -1) { row = rowsEnd.length; rowsEnd.push(-Infinity); }
      if (row >= maxRows) return { p, hidden: true, lx, ly: 0 };
      rowsEnd[row] = lx + w / 2 + 4;
      return { p, hidden: false, lx, ly: labelTop + row * 17 };
    });
    const rowsUsed = Math.min(maxRows, rowsEnd.length);
    const ticks = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
    return { x, placed, labels, height: labelTop + rowsUsed * 17 + 8, ticks };
  }, [items, min, max, width]);

  const { x, placed, labels, height, ticks } = layout;
  return (
    <div className="glance" ref={wrapRef}>
      <svg width={width} height={height} role="img" aria-label={`${items.length} ${noun}s placed by ${unit} per present day`}>
        {/* healthy band + benchmark */}
        <rect x={x(min)} y={axisY - 44} width={x(max) - x(min)} height={88} rx={6} fill={family.tealGreen.light} opacity={0.35} />
        <line x1={x(benchmark)} x2={x(benchmark)} y1={axisY - 44} y2={axisY + 44} stroke={wellness.healthy} strokeDasharray="4 4" />
        <text x={(x(min) + x(max)) / 2} y={axisY - 52} textAnchor="middle" className="glance-band">
          Healthy load {min}h–{max}h (±{variancePct}%)
        </text>
        <text x={padX - 10} y={16} className="glance-side">◄ Spare capacity</text>
        <text x={width - padX + 10} y={16} textAnchor="end" className="glance-side">Stretched ►</text>
        {/* axis */}
        <line x1={padX} x2={width - padX} y1={axisY} y2={axisY} stroke={slate[100]} strokeWidth={2} />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={axisY + 46} y2={axisY + 50} stroke={slate[200]} />
            <text x={x(t)} y={axisY + 62} textAnchor="middle" className="glance-tick">{t}h</text>
          </g>
        ))}
        {/* leader lines + labels */}
        {labels.filter((l) => !l.hidden).map(({ p, lx, ly }) => (
          <g key={`l-${p.it.name}`}>
            <path d={`M${p.cx},${p.cy + R} L${p.cx},${axisY + 50} L${lx},${ly - 11}`} fill="none" stroke={slate[200]} />
            <text x={lx} y={ly} textAnchor="middle" className="glance-label">{p.it.name}</text>
          </g>
        ))}
        {/* dots */}
        {placed.map(({ it, cx, cy }) => (
          <circle key={it.name} cx={cx} cy={cy} r={hover?.it.name === it.name ? R + 2 : R} fill={LOAD_COLOR[it.status]} stroke="#fff" strokeWidth={2}
            style={{ cursor: pickable ? 'pointer' : 'default' }}
            tabIndex={0} role={pickable ? 'button' : undefined}
            aria-label={`${it.name}: ${it.value.toFixed(2)}h, ${LOAD_LABEL[it.status]}`}
            onMouseEnter={() => setHover({ it, x: cx, y: cy })} onMouseLeave={() => setHover(null)}
            onFocus={() => setHover({ it, x: cx, y: cy })} onBlur={() => setHover(null)}
            onClick={() => pickable && onPick?.(it.name)}
            onKeyDown={(e) => { if (pickable && e.key === 'Enter') onPick?.(it.name); }} />
        ))}
      </svg>
      {hover && (
        <div className="chart-tip glance-tip" style={{ left: Math.min(Math.max(hover.x, 110), width - 110), top: hover.y - 14 }}>
          <b>{hover.it.name}</b>
          <span>{hover.it.value.toFixed(2)}h {unit} / present day</span>
          <span style={{ color: LOAD_COLOR[hover.it.status], fontWeight: 700 }}>{LOAD_LABEL[hover.it.status]}</span>
          {hover.it.people !== undefined && <span className="muted">{hover.it.people} people</span>}
          {pickable && <span className="click-hint">Click to see its people</span>}
        </div>
      )}
    </div>
  );
}
