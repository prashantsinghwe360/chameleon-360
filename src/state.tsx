import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { CapacityConfig, CohortDef, Dataset, Insight, PageKey, PeriodKey, RedFlagConfig, Threshold } from './types';
import { computeInsightRules } from './lib/insightRules';
import type { LoadedDataset } from './data/loadDataset';
export type { PageKey } from './types';
import { filterScope, makeScope, personStats, type PersonStat, type Scope } from './lib/metrics';

export const ALL_TEAMS = '__all__';
export const ALL_CATEGORIES = '__all__';


/** Where the user is: a page, optionally a section to scroll to, optionally a detail view. */
interface Loc { page: PageKey; anchor: string | null; detail: string | null }

interface Ctx {
  ds: Dataset;
  /** where the data came from (client folder, row counts) */
  meta: Omit<LoadedDataset, 'dataset'>;
  period: PeriodKey; setPeriod: (p: PeriodKey) => void;
  /** global team filter (ALL_TEAMS = everyone) */
  team: string; setTeam: (t: string) => void;
  teams: { name: string; people: number }[];
  teamLabel: string;
  /** how group charts break down: by department for all teams, by person when one team is selected */
  breakdown: 'department' | 'person';
  /** "department" / "person" for titles; "Department" / "Person" for headers */
  groupNoun: string; GroupNoun: string;
  /** app / website category filter (Apps & websites tab) */
  category: string; setCategory: (c: string) => void;
  categories: string[];
  /** scope narrowed to the selected team; every page reads this */
  scope: Scope;
  stats: PersonStat[];
  /** people with enough present days to be judged (config.minPresentDaysForLists) */
  reliable: PersonStat[];
  under: Threshold; setUnder: (t: Threshold) => void;
  redFlag: RedFlagConfig; setRedFlag: (r: RedFlagConfig) => void;
  /** user-defined cohorts (start from config presets) */
  cohorts: CohortDef[]; setCohorts: (c: CohortDef[]) => void;
  /** daily capacity benchmark (shared by Time & Capacity and the decision rules) */
  capacityCfg: CapacityConfig; setCapacityCfg: (c: CapacityConfig) => void;
  /** decision rules evaluated on the current scope; filter by page */
  rules: Insight[];
  rulesFor: (page: PageKey, tones?: Insight['tone'][]) => Insight[];
  page: PageKey;
  /** changes on every navigation so the same section can be scrolled to twice */
  anchor: string | null;
  detail: string | null;
  canGoBack: boolean;
  backLabel: string | null;
  go: (page: PageKey, anchor?: string) => void;
  /** open a full-page detail view; Back returns to `fromSection` on the current page */
  openDetail: (detail: string, fromSection: string) => void;
  back: () => void;
}
const DashCtx = createContext<Ctx | null>(null);

export const PAGE_TITLE: Record<PageKey, string> = {
  overview: 'Overview', teams: 'Teams', capacity: 'Time & Capacity', cohorts: 'Cohorts', ai: 'AI adoption', apps: 'Apps & websites', data: 'Data & settings',
};

export function DashboardProvider({ ds, meta, children }: { ds: Dataset; meta: Omit<LoadedDataset, 'dataset'>; children: ReactNode }) {
  const [period, setPeriod] = useState<PeriodKey>('6m');
  const [under, setUnder] = useState<Threshold>(ds.config.defaults.underThreshold);
  const [redFlag, setRedFlag] = useState<RedFlagConfig>(ds.config.defaults.redFlag);
  const [cohorts, setCohorts] = useState<CohortDef[]>(ds.config.defaults.cohorts);
  const [capacityCfg, setCapacityCfg] = useState<CapacityConfig>(ds.config.defaults.capacity);
  const [loc, setLoc] = useState<Loc & { n: number }>({ page: 'overview', anchor: null, detail: null, n: 0 });
  const [history, setHistory] = useState<Loc[]>([]);

  const [team, setTeam] = useState<string>(ALL_TEAMS);
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const fullScope = useMemo(() => makeScope(ds, period), [ds, period]);
  const teams = useMemo(() => {
    const m = new Map<string, number>();
    fullScope.employees.forEach((e) => m.set(e.team, (m.get(e.team) ?? 0) + 1));
    return [...m.entries()].map(([name, people]) => ({ name, people })).sort((a, b) => a.name.localeCompare(b.name));
  }, [fullScope]);
  const scope = useMemo(() => (team === ALL_TEAMS ? fullScope : filterScope(fullScope, (e) => e.team === team)), [fullScope, team]);
  const stats = useMemo(() => personStats(scope), [scope]);
  const rules = useMemo(() => computeInsightRules(ds, scope, stats, capacityCfg), [ds, scope, stats, capacityCfg]);
  const categories = useMemo(() => {
    const nonWork = new Set(ds.config.nonWorkCategories);
    const all = [...new Set(scope.usage.map((u) => u.category))];
    // non-work categories first, then the rest alphabetically
    return [...all.filter((c) => nonWork.has(c)).sort(), ...all.filter((c) => !nonWork.has(c)).sort()];
  }, [scope, ds]);
  const reliable = useMemo(() => stats.filter((s) => s.presentDays >= ds.config.minPresentDaysForLists), [stats, ds]);

  const move = (next: Loc, from: Loc | null) => {
    if (from) setHistory((h) => [...h.slice(-19), from]);
    setLoc((s) => ({ ...next, n: s.n + 1 }));
  };
  const prev = history[history.length - 1];

  const value: Ctx = {
    ds, meta, period, setPeriod, team, setTeam, teams, teamLabel: team === ALL_TEAMS ? 'all teams' : team,
    breakdown: team === ALL_TEAMS ? 'department' : 'person',
    groupNoun: team === ALL_TEAMS ? 'department' : 'person', GroupNoun: team === ALL_TEAMS ? 'Department' : 'Person', category, setCategory, categories, scope, stats, reliable, under, setUnder, redFlag, setRedFlag, cohorts, setCohorts, capacityCfg, setCapacityCfg, rules,
    rulesFor: (pg, tones) => rules.filter((r) => r.pages?.includes(pg) && (!tones || tones.includes(r.tone))),
    page: loc.page, detail: loc.detail,
    anchor: loc.anchor ? `${loc.anchor}#${loc.n}` : null,
    canGoBack: history.length > 0,
    backLabel: prev ? PAGE_TITLE[prev.page] : null,
    go: (page, anchor) => move({ page, anchor: anchor ?? null, detail: null }, { page: loc.page, anchor: null, detail: loc.detail }),
    openDetail: (detail, fromSection) => move({ page: loc.page, anchor: null, detail }, { page: loc.page, anchor: fromSection, detail: null }),
    back: () => {
      if (!prev) return;
      setHistory((h) => h.slice(0, -1));
      setLoc((s) => ({ ...prev, n: s.n + 1 }));
    },
  };
  return <DashCtx.Provider value={value}>{children}</DashCtx.Provider>;
}

export function useDash() {
  const c = useContext(DashCtx);
  if (!c) throw new Error('useDash outside provider');
  return c;
}
