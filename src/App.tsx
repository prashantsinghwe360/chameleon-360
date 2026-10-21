import { useEffect, useRef, useState } from 'react';
import { Bot, Database, LayoutGrid, Menu, MousePointerClick, Users, UsersRound } from 'lucide-react';
import type { Dataset, PeriodKey } from './types';
import { DashboardProvider, useDash, type PageKey } from './state';
import { Select } from './components/ui';
import { fmtDate, PERIOD_LABEL } from './lib/metrics';
import { OverviewPage } from './pages/Overview';
import { TeamsPage } from './pages/Teams';
import { AIPage } from './pages/AI';
import { AppsPage } from './pages/Apps';
import { PeoplePage } from './pages/People';
import { DataPage } from './pages/DataPage';
import { mockDataset } from './data/mockData';
import './styles.css';

const NAV: { key: PageKey; label: string; icon: typeof LayoutGrid; sections?: [string, string][] }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid },
  { key: 'teams', label: 'Teams & cohorts', icon: UsersRound, sections: [['patterns', 'Department patterns'], ['monthly', 'Monthly trend'], ['composition', 'Composition'], ['ranking', 'Leading vs lagging'], ['cohorts', 'Cohort explorer']] },
  { key: 'ai', label: 'AI adoption', icon: Bot, sections: [['adoption', 'Adoption'], ['tools', 'Users by tool'], ['nonai', 'No AI use'], ['power', 'Power users'], ['trend', 'Monthly trend']] },
  { key: 'apps', label: 'Apps & websites', icon: MousePointerClick, sections: [['top', 'What people do'], ['urls', 'Productive vs unproductive'], ['screening', 'Non-work screening']] },
  { key: 'people', label: 'People', icon: Users, sections: [['threshold', 'Below a threshold'], ['unproductive', 'Unproductive visitors'], ['redflags', 'Red flags']] },
];

function Shell() {
  const { ds, page, anchor, go, period, setPeriod, scope } = useDash();
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
  }, [page, anchor]);

  const Page = { overview: OverviewPage, teams: TeamsPage, ai: AIPage, apps: AppsPage, people: PeoplePage, data: DataPage }[page];

  return (
    <div className={`shell ${open ? 'nav-open' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>{ds.config.vendorName.slice(0, 2)}</span>
          <div><b>{ds.config.vendorName}</b><small>{ds.config.clientName} review</small></div>
        </div>
        <nav aria-label="Dashboard pages">
          {NAV.map((n) => (
            <div key={n.key} className="nav-group">
              <button className={`nav-item ${page === n.key ? 'active' : ''}`} aria-current={page === n.key ? 'page' : undefined} onClick={() => go(n.key)}>
                <n.icon size={18} aria-hidden /> {n.label}
              </button>
              {page === n.key && n.sections && (
                <div className="nav-sub">
                  {n.sections.map(([id, label]) => <button key={id} onClick={() => go(n.key, id)}>{label}</button>)}
                </div>
              )}
            </div>
          ))}
        </nav>
        <button className={`nav-item foot ${page === 'data' ? 'active' : ''}`} onClick={() => go('data')}>
          <Database size={18} aria-hidden /> Data & settings
        </button>
      </aside>
      <button className="scrim" aria-label="Close menu" onClick={() => setOpen(false)} />

      <main ref={mainRef} className="main">
        <div className="topbar">
          <button className="menu-btn" aria-label="Open menu" onClick={() => setOpen(true)}><Menu size={20} /></button>
          <div className="range">
            <b>{fmtDate(scope.range.start)} – {fmtDate(scope.range.end)}</b>
            <span>{scope.range.workingDays} working days{scope.range.clipped ? ` · only ${fmtDate(scope.range.dataStart)} onward is available` : ''}</span>
          </div>
          <Select<PeriodKey> label="Period" value={period} onChange={setPeriod}
            options={(Object.keys(PERIOD_LABEL) as PeriodKey[]).map((k) => ({ value: k, label: PERIOD_LABEL[k] }))} />
        </div>
        <div className="content"><Page /></div>
      </main>
    </div>
  );
}

export default function App({ dataset = mockDataset }: { dataset?: Dataset }) {
  return <DashboardProvider ds={dataset}><Shell /></DashboardProvider>;
}
