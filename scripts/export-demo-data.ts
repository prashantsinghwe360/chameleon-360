/* Writes the demo client's datasets to data/demo-client/ as CSV + JSON.
 * Run: npm run data:demo
 * Real clients do not need this script - drop their exports into data/<client-id>/. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mockDataset } from './demoData';

const out = join(process.cwd(), 'data', 'demo-client');
mkdirSync(out, { recursive: true });

const esc = (v: unknown) => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const hms = (sec: number) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};
function write(name: string, header: string[], rows: unknown[][]) {
  const body = [header.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n') + '\n';
  writeFileSync(join(out, name), body);
  console.log(`${name}: ${rows.length.toLocaleString()} rows, ${(body.length / 1e6).toFixed(1)} MB`);
}

const ds = mockDataset;
write('employees.csv',
  ['Employee ID', 'Name', 'Department', 'Team', 'Designation', 'Joining Date', 'Excluded'],
  ds.employees.map((e) => [e.id, e.name, e.department, e.team, e.designation ?? '', e.joinDate ?? '', e.excluded ? 'Yes' : 'No']));
write('daily_activity.csv',
  ['Employee ID', 'Date', 'Present', 'Online Time', 'Active Time', 'Productive Time', 'Neutral Time', 'Unproductive Time', 'Punch Span'],
  ds.daily.map((d) => [d.employeeId, d.date, d.present ? 'Yes' : 'No', hms(d.onlineSec), hms(d.activeSec), hms(d.productiveSec), hms(d.neutralSec), hms(d.unproductiveSec), d.spanSec ? hms(d.spanSec) : '']));
write('app_usage.csv',
  ['Employee ID', 'Date', 'App/URL', 'Type', 'Productivity', 'Category', 'Active Time'],
  ds.appUsage.map((u) => [u.employeeId, u.date, u.name, u.kind === 'url' ? 'URL' : 'App', u.productivity, u.category, hms(u.activeSec)]));
writeFileSync(join(out, 'client_config.json'), JSON.stringify(ds.config, null, 2) + '\n');
console.log('client_config.json written');
