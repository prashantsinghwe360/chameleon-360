import { useEffect, useRef, useState } from 'react';
import { Bot, ChevronDown, Clock, Database, Gauge, Layers, LayoutGrid, Menu, MousePointerClick, UsersRound } from 'lucide-react';
import { DashboardProvider, useDash, type PageKey } from './state';
import { OverviewPage } from './pages/Overview';
import { TeamsPage } from './pages/Teams';
import { CohortsPage } from './pages/Cohorts';
import { CapacityPage } from './pages/Capacity';
import { AIPage } from './pages/AI';
import { AppsPage } from './pages/Apps';
import { DataPage } from './pages/DataPage';
import type { LoadedDataset } from './data/loadDataset';

/** Tabs of the Executive Dashboard. Sections inside a tab are reached from the page itself. */
const DASHBOARD_TABS: { key: PageKey; label: string; icon: typeof LayoutGrid }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid },
  { key: 'teams', label: 'Teams', icon: UsersRound },
  { key: 'capacity', label: 'Time & Capacity', icon: Clock },
  { key: 'cohorts', label: 'Cohorts', icon: Layers },
  { key: 'ai', label: 'AI adoption', icon: Bot },
  { key: 'apps', label: 'Apps & websites', icon: MousePointerClick },
];

function Shell() {
  const { ds, page, anchor, detail, go } = useDash();
  const [dashOpen, setDashOpen] = useState(true);
  const mainRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const id = anchor?.split('#')[0];
    requestAnimationFrame(() => {
      const el = id ? document.getElementById(id) : null;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
      } else mainRef.current?.scrollTo({ top: 0 });
    });
    setOpen(false);
  }, [page, anchor, detail]);

  const Page = { overview: OverviewPage, teams: TeamsPage, capacity: CapacityPage, cohorts: CohortsPage, ai: AIPage, apps: AppsPage, data: DataPage }[page];

  return (
    <div className={`shell ${open ? 'nav-open' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>w360</span>
          <div>
            <b>{ds.config.vendorName.replace(/\.ai$/i, '')}{/\.ai$/i.test(ds.config.vendorName) && <span className="ai">.ai</span>}</b>
            <small>{ds.config.clientName}</small>
          </div>
        </div>
        <nav aria-label="Main">
          <button className="nav-item nav-parent" aria-expanded={dashOpen} onClick={() => setDashOpen((v) => !v)}>
            <Gauge size={18} aria-hidden /> Executive Dashboard
            <ChevronDown size={16} aria-hidden className="nav-caret" />
          </button>
          {dashOpen && (
            <div className="nav-children">
              {DASHBOARD_TABS.map((n) => (
                <button key={n.key} className={`nav-item nav-child ${page === n.key ? 'active' : ''}`} aria-current={page === n.key ? 'page' : undefined} onClick={() => go(n.key)}>
                  <n.icon size={16} aria-hidden /> {n.label}
                </button>
              ))}
            </div>
          )}
        </nav>
        <button className={`nav-item foot ${page === 'data' ? 'active' : ''}`} onClick={() => go('data')}>
          <Database size={18} aria-hidden /> Data & settings
        </button>
      </aside>
      <button className="scrim" aria-label="Close menu" onClick={() => setOpen(false)} />

      <main ref={mainRef} className="main">
        {/* mobile only: the menu button (filters now live in each page header) */}
        <div className="topbar">
          <button className="menu-btn" aria-label="Open menu" onClick={() => setOpen(true)}><Menu size={20} /></button>
          <b className="topbar-title">{ds.config.clientName}</b>
        </div>
        <div className="content"><Page /></div>
      </main>
    </div>
  );
}

export default function App({ loaded }: { loaded: LoadedDataset }) {
  return <DashboardProvider ds={loaded.dataset} meta={loaded}><Shell /></DashboardProvider>;
}
