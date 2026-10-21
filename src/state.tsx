import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Dataset, PeriodKey, RedFlagConfig, Threshold } from './types';
import { makeScope, personStats, type PersonStat, type Scope } from './lib/metrics';

export type PageKey = 'overview' | 'teams' | 'ai' | 'apps' | 'people' | 'data';

interface Ctx {
  ds: Dataset;
  period: PeriodKey; setPeriod: (p: PeriodKey) => void;
  scope: Scope;
  stats: PersonStat[];
  /** people with enough present days to be judged (config.minPresentDaysForLists) */
  reliable: PersonStat[];
  under: Threshold; setUnder: (t: Threshold) => void;
  redFlag: RedFlagConfig; setRedFlag: (r: RedFlagConfig) => void;
  page: PageKey; anchor: string | null;
  go: (page: PageKey, anchor?: string) => void;
}
const DashCtx = createContext<Ctx | null>(null);

export function DashboardProvider({ ds, children }: { ds: Dataset; children: ReactNode }) {
  const [period, setPeriod] = useState<PeriodKey>('6m');
  const [under, setUnder] = useState<Threshold>(ds.config.defaults.underThreshold);
  const [redFlag, setRedFlag] = useState<RedFlagConfig>(ds.config.defaults.redFlag);
  const [nav, setNav] = useState<{ page: PageKey; anchor: string | null; n: number }>({ page: 'overview', anchor: null, n: 0 });

  const scope = useMemo(() => makeScope(ds, period), [ds, period]);
  const stats = useMemo(() => personStats(scope), [scope]);
  const reliable = useMemo(() => stats.filter((s) => s.presentDays >= ds.config.minPresentDaysForLists), [stats, ds]);

  const value: Ctx = {
    ds, period, setPeriod, scope, stats, reliable, under, setUnder, redFlag, setRedFlag,
    page: nav.page, anchor: nav.anchor ? `${nav.anchor}#${nav.n}` : null,
    go: (page, anchor) => setNav((s) => ({ page, anchor: anchor ?? null, n: s.n + 1 })),
  };
  return <DashCtx.Provider value={value}>{children}</DashCtx.Provider>;
}

export function useDash() {
  const c = useContext(DashCtx);
  if (!c) throw new Error('useDash outside provider');
  return c;
}
