/* =====================================================================
 * ADAPTER TEMPLATE - turn any client's raw export into a Dataset.
 * ---------------------------------------------------------------------
 * The deck was built from three We360 exports. Map their columns here,
 * then pass the result to <App dataset={...} />. Column names below are
 * examples - rename them to whatever the export actually uses.
 * ===================================================================== */
import type { AppUsageRecord, ClientConfig, DailyRecord, Dataset, Employee, Productivity } from '../types';

type Row = Record<string, string>;

const num = (v: string | undefined) => (v ? Number(v) || 0 : 0);
/** "HH:MM:SS" or seconds -> seconds */
const toSec = (v: string | undefined) => {
  if (!v) return 0;
  if (v.includes(':')) {
    const [h, m, s] = v.split(':').map(Number);
    return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
  }
  return num(v);
};

export function buildDataset(
  config: ClientConfig,
  employeeRows: Row[],     // users / org hierarchy export
  ledgerRows: Row[],       // daily attendance + activity export
  usageRows: Row[],        // app & url usage export
): Dataset {
  const employees: Employee[] = employeeRows.map((r) => ({
    id: r['Employee ID'],
    name: r['Name'],
    department: r['Department'] || config.unassignedDepartment || 'Unassigned',
    team: r['Team'] || r['Department'] || 'Unassigned',
    designation: r['Designation'] || undefined,
    joinDate: r['Joining Date'] || undefined,
    excluded: /test|admin/i.test(r['Name'] ?? ''),
  }));

  const daily: DailyRecord[] = ledgerRows.map((r) => {
    const onlineSec = toSec(r['Online Time']);
    const activeSec = toSec(r['Active Time']);
    return {
      employeeId: r['Employee ID'],
      date: r['Date'],
      present: Boolean(r['Punch In'] || onlineSec > 0),
      onlineSec,
      activeSec,
      productiveSec: toSec(r['Productive Time']),
      neutralSec: toSec(r['Neutral Time']),
      unproductiveSec: toSec(r['Unproductive Time']),
      spanSec: toSec(r['Punch Span']) || undefined,
    };
  });

  const appUsage: AppUsageRecord[] = usageRows.map((r) => ({
    employeeId: r['Employee ID'],
    date: r['Date'],
    name: r['App/URL'],
    kind: r['Type']?.toLowerCase() === 'url' ? 'url' : 'app',
    productivity: (r['Productivity']?.toLowerCase() as Productivity) || 'neutral',
    category: r['Category'] || 'Uncategorised',
    activeSec: toSec(r['Active Time']),
  }));

  return { config, employees, daily, appUsage };
}
