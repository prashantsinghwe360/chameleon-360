import { useDash } from '../state';
import { PageHeader, Section } from '../components/ui';
import { fmtDate, fmtN } from '../lib/metrics';

const SCHEMA: [string, string, string][] = [
  ['Employee', 'id, name, department, team, designation?, joinDate?, excluded?', 'One row per person - the org snapshot'],
  ['DailyRecord', 'employeeId, date, present, onlineSec, activeSec, productiveSec, neutralSec, unproductiveSec, spanSec?', 'One row per person per working day, including days with no signal'],
  ['AppUsageRecord', 'employeeId, date (bucket), name, kind app|url, productivity, category, activeSec', 'App & website time per person per day / week / month'],
  ['ClientConfig', 'excluded apps, non-work categories, AI tool patterns, list minimums, default thresholds', 'The rules an analyst used to set by hand'],
];

export function DataPage() {
  const { ds, scope } = useDash();
  const c = ds.config;
  return (
    <>
      <PageHeader title="Data & settings" lede="What this dashboard is reading and the rules applied. Load another client by swapping the dataset - no page changes." />
      <div className="grid">
        <Section span={6} title="Loaded dataset">
          <dl className="facts">
            <dt>Client</dt><dd>{c.clientName}</dd>
            <dt>Data available</dt><dd>{fmtDate(scope.range.dataStart)} – {fmtDate(scope.range.end)}</dd>
            <dt>People</dt><dd>{fmtN(ds.employees.filter((e) => !e.excluded).length)} tracked · {ds.employees.filter((e) => e.excluded).length} excluded test/admin</dd>
            <dt>Daily ledger rows</dt><dd>{fmtN(ds.daily.length)}</dd>
            <dt>App usage rows</dt><dd>{fmtN(ds.appUsage.length)}</dd>
          </dl>
        </Section>
        <Section span={6} title="Client rules">
          <dl className="facts">
            <dt>Hidden from top apps</dt><dd>{c.excludeFromTopApps.join(', ')}</dd>
            <dt>Non-work categories</dt><dd>{c.nonWorkCategories.join(', ')}</dd>
            <dt>AI tools detected</dt><dd>{Object.keys(c.aiTools).join(', ')}</dd>
            <dt>Minimum days for lists</dt><dd>{c.minPresentDaysForLists} present days</dd>
            <dt>Minimum group size</dt><dd>{c.minGroupSize} people</dd>
          </dl>
        </Section>
        <Section title="Data contract" note="Defined in src/types.ts. A client export is mapped to these shapes in src/data/adapter.ts.">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Table</th><th>Fields</th><th>Grain</th></tr></thead>
              <tbody>{SCHEMA.map(([t, f, g]) => <tr key={t}><td><b>{t}</b></td><td className="mono-ish">{f}</td><td>{g}</td></tr>)}</tbody>
            </table>
          </div>
        </Section>
      </div>
    </>
  );
}
