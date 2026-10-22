import '@fontsource/lato/latin-400.css';
import '@fontsource/lato/latin-700.css';
import '@fontsource/lato/latin-900.css';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { loadDataset, type LoadedDataset } from './data/loadDataset';
import './styles.css';

function Root() {
  const [state, setState] = useState<{ data?: LoadedDataset; error?: string }>({});
  useEffect(() => {
    // parsing ~10 MB of CSV takes a moment; yield first so the loading screen paints
    const t = setTimeout(() => {
      loadDataset().then((data) => setState({ data })).catch((e: Error) => setState({ error: e.message }));
    }, 30);
    return () => clearTimeout(t);
  }, []);
  if (state.error) return (
    <div className="boot boot-error" role="alert">
      <b>Could not load the dashboard data</b>
      <p>{state.error}</p>
      <p className="muted">Each client folder under <code>data/</code> needs employees.csv, daily_activity.csv and app_usage.csv (client_config.json is optional). See data/README.md.</p>
    </div>
  );
  if (!state.data) return <div className="boot" aria-live="polite"><span className="boot-spinner" aria-hidden />Loading workforce data…</div>;
  return <App loaded={state.data} />;
}

createRoot(document.getElementById('root')!).render(<StrictMode><Root /></StrictMode>);
