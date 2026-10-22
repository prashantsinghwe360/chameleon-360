/* =====================================================================
 * ADAPTER - turns a client's raw exports (CSV rows) into a Dataset.
 * ---------------------------------------------------------------------
 * Column names follow the We360 exports in data/<client>/. If a client's
 * export uses different headers, change COLUMNS below - nothing else.
 * ===================================================================== */
import type { AppUsageRecord, ClientConfig, DailyRecord, Dataset, Employee, Productivity } from '../types';

type Row = Record<string, string>;

/** Header names per file. Edit here to map another export format. */
export const COLUMNS = {
  employees: { id: 'Employee ID', name: 'Name', department: 'Department', team: 'Team', designation: 'Designation', joinDate: 'Joining Date', excluded: 'Excluded' },
  daily: { id: 'Employee ID', date: 'Date', present: 'Present', online: 'Online Time', active: 'Active Time', productive: 'Productive Time', neutral: 'Neutral Time', unproductive: 'Unproductive Time', span: 'Punch Span' },
  usage: { id: 'Employee ID', date: 'Date', name: 'App/URL', type: 'Type', productivity: 'Productivity', category: 'Category', active: 'Active Time' },
} as const;

/** Required columns per file - loading fails with a clear message if one is missing. */
const REQUIRED = {
  employees: ['id', 'name', 'department'],
  daily: ['id', 'date', 'online', 'active', 'productive'],
  usage: ['id', 'date', 'name', 'productivity', 'active'],
} as const;

const yes = (v: string | undefined) => /^(yes|y|true|1)$/i.test(v ?? '');
/** "HH:MM:SS", "MM:SS" or plain seconds -> seconds */
export const toSec = (v: string | undefined) => {
  if (!v) return 0;
  if (v.includes(':')) {
    const p = v.split(':').map(Number);
    const [h, m, s] = p.length === 3 ? p : [0, p[0], p[1]];
    return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
  }
  return Number(v) || 0;
};
/** Accepts YYYY-MM-DD, DD/MM/YYYY and DD-MM-YYYY. */
export const toIsoDate = (v: string) => {
  const m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : v.slice(0, 10);
};

export class DatasetError extends Error {}

function check(file: keyof typeof COLUMNS, rows: Row[]) {
  if (!rows.length) throw new DatasetError(`${file}: the file is empty.`);
  const cols = COLUMNS[file] as Record<string, string>;
  const missing = REQUIRED[file].map((k) => cols[k]).filter((h) => !(h in rows[0]));
  if (missing.length) throw new DatasetError(`${file}: missing column${missing.length > 1 ? 's' : ''} ${missing.map((m) => `"${m}"`).join(', ')}.`);
}

export function buildDataset(config: ClientConfig, employeeRows: Row[], ledgerRows: Row[], usageRows: Row[]): Dataset {
  check('employees', employeeRows); check('daily', ledgerRows); check('usage', usageRows);
  const E = COLUMNS.employees, D = COLUMNS.daily, U = COLUMNS.usage;

  const employees: Employee[] = employeeRows.map((r) => ({
    id: r[E.id],
    name: r[E.name],
    department: r[E.department] || config.unassignedDepartment || 'Unassigned',
    team: r[E.team] || r[E.department] || 'Unassigned',
    designation: r[E.designation] || undefined,
    joinDate: r[E.joinDate] ? toIsoDate(r[E.joinDate]) : undefined,
    excluded: E.excluded in r ? yes(r[E.excluded]) : /test|admin/i.test(r[E.name] ?? ''),
  }));

  const daily: DailyRecord[] = ledgerRows.map((r) => {
    const onlineSec = toSec(r[D.online]);
    return {
      employeeId: r[D.id],
      date: toIsoDate(r[D.date]),
      // explicit Present column when the export has one, otherwise any online signal
      present: D.present in r ? yes(r[D.present]) : onlineSec > 0,
      onlineSec,
      activeSec: toSec(r[D.active]),
      productiveSec: toSec(r[D.productive]),
      neutralSec: toSec(r[D.neutral]),
      unproductiveSec: toSec(r[D.unproductive]),
      spanSec: toSec(r[D.span]) || undefined,
    };
  });

  const appUsage: AppUsageRecord[] = usageRows.map((r) => ({
    employeeId: r[U.id],
    date: toIsoDate(r[U.date]),
    name: r[U.name],
    kind: /url|web/i.test(r[U.type] ?? '') || /\.[a-z]{2,}$/i.test(r[U.name] ?? '') ? 'url' : 'app',
    productivity: (['productive', 'neutral', 'unproductive'].includes((r[U.productivity] ?? '').toLowerCase())
      ? r[U.productivity].toLowerCase() : 'neutral') as Productivity,
    category: r[U.category] || 'Uncategorised',
    activeSec: toSec(r[U.active]),
  }));

  return { config, employees, daily, appUsage };
}
