/* =====================================================================
 * MOCK DATASET - calibrated to the Client Review Deck (17 Mar - 16 Sep 2026)
 * ---------------------------------------------------------------------
 * The deck only contains aggregates, so this file rebuilds plausible RAW
 * rows (people, daily ledger, app usage) whose totals land close to the
 * deck. Named individuals from the deck are seeded in so the lists match.
 * Replace this whole file with a real adapter - nothing else depends on it.
 * ===================================================================== */
import type { AppUsageRecord, DailyRecord, Dataset, Employee, Productivity } from '../src/types';
import { clientConfig } from '../src/data/clientConfig';

/* ---------- deterministic random ---------- */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260917);
const normal = () => {
  let u = 0, v = 0;
  while (u === 0) u = rnd();
  while (v === 0) v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const logn = (sigma: number) => Math.exp(sigma * normal() - (sigma * sigma) / 2);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/* ---------- org structure (from deck slides 4, 7, 8, 18) ---------- */
type Group = 'dev' | 'ops' | 'sf' | 'sap' | 'fin' | 'people' | 'biz';
interface TeamSpec { dept: string; team: string; n: number; mean: number; comp: [number, number, number]; group: Group }
const TEAMS: TeamSpec[] = [
  { dept: 'MSO', team: 'MSO - Applications', n: 16, mean: 3.98, comp: [87.5, 11.6, 0.9], group: 'ops' },
  { dept: 'Managed Services', team: 'Managed Services', n: 11, mean: 3.95, comp: [88.0, 11.1, 0.9], group: 'ops' },
  { dept: 'MSO', team: 'MSO - Monitoring', n: 17, mean: 3.73, comp: [90.8, 8.4, 0.8], group: 'ops' },
  { dept: 'MSO', team: 'MSO - Infra & AIOps', n: 16, mean: 3.69, comp: [93.7, 5.6, 0.7], group: 'ops' },
  { dept: 'People & Culture', team: 'People & Culture', n: 12, mean: 3.65, comp: [85.8, 10.3, 3.9], group: 'people' },
  { dept: 'GCC Data AI Presales', team: 'GCC Data AI Presales', n: 12, mean: 3.61, comp: [94.0, 5.2, 0.8], group: 'biz' },
  { dept: 'Salesforce Practice', team: 'Salesforce Practice', n: 40, mean: 3.5, comp: [85.6, 13.4, 1.0], group: 'sf' },
  { dept: 'Default', team: 'Default', n: 57, mean: 3.49, comp: [88.6, 10.4, 1.0], group: 'dev' },
  { dept: 'Finance & Compliance', team: 'Finance & Compliance', n: 8, mean: 3.36, comp: [76.7, 8.4, 14.9], group: 'fin' },
  { dept: 'TCoE', team: 'TCoE', n: 62, mean: 3.34, comp: [89.8, 9.7, 0.5], group: 'dev' },
  { dept: 'Product and Innovation', team: 'Product and Innovation', n: 56, mean: 3.21, comp: [86.5, 12.3, 1.2], group: 'dev' },
  { dept: 'Product Development', team: 'Product Development', n: 80, mean: 3.01, comp: [87.2, 11.5, 1.3], group: 'dev' },
  { dept: 'ESBU', team: 'ESBU', n: 11, mean: 2.89, comp: [83.8, 15.2, 1.0], group: 'dev' },
  { dept: 'Service Delivery Mgmt', team: 'Service Delivery Mgmt', n: 31, mean: 2.75, comp: [92.0, 7.3, 0.8], group: 'ops' },
  { dept: 'AG MGATE', team: 'AG MGATE', n: 3, mean: 2.73, comp: [79.5, 16.6, 3.9], group: 'biz' },
  { dept: 'Marketing & Partnership', team: 'Marketing & Partnership', n: 4, mean: 2.42, comp: [86.1, 9.7, 4.2], group: 'biz' },
  { dept: 'MSO', team: 'MSO - Ops & Service Mgmt', n: 6, mean: 2.23, comp: [75.5, 21.0, 3.5], group: 'ops' },
  { dept: 'Software Engineering', team: 'Software Engineering', n: 3, mean: 1.96, comp: [91.1, 8.8, 0.1], group: 'dev' },
  { dept: 'SAP Practice', team: 'SAP Practice', n: 7, mean: 1.64, comp: [90.8, 5.4, 3.7], group: 'sap' },
  { dept: 'Sales - MY SG ASEAN', team: 'Sales - MY SG ASEAN', n: 8, mean: 1.16, comp: [83.0, 10.7, 6.4], group: 'biz' },
  { dept: 'IT Security & Governance', team: 'IT Security & Governance', n: 2, mean: 3.6, comp: [90, 9, 1], group: 'ops' },
];

/* ---------- named individuals from the deck ---------- */
interface Named {
  name: string; team: string; avg?: number; days?: number; noAI?: boolean;
  aiHrs?: number; unprod?: { item: string; hrs: number };
}
const NAMED: Named[] = [
  { name: 'Dominic Domingo', team: 'Product Development', avg: 0.4, days: 37, noAI: true },
  { name: 'Muhammad Ismail', team: 'Sales - MY SG ASEAN', avg: 0.44, days: 92 },
  { name: 'Gaurav Bhargava', team: 'GCC Data AI Presales', avg: 0.54, days: 120 },
  { name: 'Karthyshree Pitchai', team: 'Service Delivery Mgmt', avg: 0.65, days: 113 },
  { name: 'Menakasri Rajendran', team: 'Sales - MY SG ASEAN', avg: 0.67, days: 25 },
  { name: 'Shiridi Shanmugam', team: 'ESBU', avg: 0.7, days: 124, noAI: true },
  { name: 'Prashanth Nagarajan', team: 'SAP Practice', avg: 0.71, days: 121 },
  { name: 'Ravibv', team: 'Finance & Compliance', avg: 0.74, days: 49 },
  { name: 'Nhat Nguyen', team: 'TCoE', avg: 0.74, days: 121, noAI: true },
  { name: 'Phyoe Thiha', team: 'MSO - Ops & Service Mgmt', avg: 0.82, days: 78 },
  { name: 'Fitri Tahir', team: 'Sales - MY SG ASEAN', avg: 0.85, days: 98 },
  { name: 'Ramakrishnan S', team: 'Service Delivery Mgmt', avg: 0.86, days: 131 },
  { name: 'Nageswara Rao', team: 'SAP Practice', avg: 0.91, days: 125, noAI: true },
  { name: 'Preetham Gangadhar', team: 'Product Development', avg: 0.94, days: 114, noAI: true },
  { name: 'Sujithkumar Pachiapp', team: 'Service Delivery Mgmt', avg: 0.96, days: 61, noAI: true },
  { name: 'Jeanny Phuong', team: 'Sales - MY SG ASEAN', avg: 1.0, days: 73, noAI: true },
  { name: 'Madan Lodhi', team: 'Product Development', avg: 1.04, days: 120, noAI: true },
  { name: 'Thuy Pham Thi Thanh', team: 'Default', avg: 1.41, days: 90, noAI: true },
  { name: 'Ronald Ng', team: 'AG MGATE', avg: 1.41, days: 100, noAI: true },
  { name: 'Alexander Panganiban', team: 'MSO - Applications', avg: 1.49, days: 110, noAI: true },
  { name: 'Ranjitha Logarathnam', team: 'Product Development', avg: 1.52, days: 105, noAI: true },
  { name: 'Farah Dayana', team: 'Default', avg: 1.76, days: 95, noAI: true },
  { name: 'Ahmad Syamil', team: 'MSO - Monitoring', avg: 1.86, days: 112, noAI: true },
  { name: 'Rakshita Kulkarni', team: 'TCoE', avg: 2.0, days: 101, noAI: true },
  { name: 'Ponpandi B', team: 'Product Development', avg: 2.04, days: 108, noAI: true },
  { name: 'Veeresh Kumar', team: 'Product Development', avg: 2.09, days: 99, noAI: true },
  { name: 'Khushi Jain', team: 'Product Development', avg: 2.13, days: 88, noAI: true },
  { name: 'Veer Ramgangwar', team: 'Product Development', avg: 2.17, days: 97, noAI: true },
  { name: 'Ekambara Thoppi', team: 'Product Development', avg: 2.18, days: 115, noAI: true },
  { name: 'Linh Tuong', team: 'Product Development', avg: 4.08, days: 118, unprod: { item: 'Steam', hrs: 165 } },
  { name: 'Nursyara Danila', team: 'Finance & Compliance', avg: 4.31, days: 120, unprod: { item: 'books.zoho.com', hrs: 98 } },
  { name: 'Siti Fatimah Zahra', team: 'Finance & Compliance', avg: 3.82, days: 117, unprod: { item: 'www2.secure.hsbcnet.com', hrs: 45 } },
  { name: 'Revathi C', team: 'SAP Practice', avg: 1.22, days: 110, unprod: { item: 'www.crazygames.com', hrs: 76 } },
  { name: 'Safurah Bee', team: 'People & Culture', avg: 5.43, days: 121, unprod: { item: 'www.linkedin.com', hrs: 74 } },
  { name: 'Vasanthan Sinnappan', team: 'Finance & Compliance', avg: 3.77, days: 119, unprod: { item: 'books.zoho.com', hrs: 50 } },
  { name: 'Phuong Vo', team: 'TCoE', avg: 2.32, days: 112, unprod: { item: 'www.youtube.com', hrs: 46 } },
  { name: 'Deekshith Shetty', team: 'Product Development', avg: 3.14, days: 109, unprod: { item: 'www.facebook.com', hrs: 40 } },
  { name: 'Priyalatha Satiaceelan', team: 'People & Culture', avg: 5.11, days: 118, unprod: { item: 'www.linkedin.com', hrs: 41 } },
  { name: 'Shashank Kulkarni', team: 'MSO - Applications', avg: 5.67, days: 120, unprod: { item: 'lloydsreg-lex.lightning.force.com', hrs: 39 } },
  { name: 'Pushpa Honnegowda', team: 'Product Development', aiHrs: 107.2 },
  { name: 'Jhansi Mj', team: 'Product Development', aiHrs: 56.1 },
  { name: 'Modium Harshavardhini', team: 'TCoE', aiHrs: 45.9 },
  { name: 'Javad', team: 'Product and Innovation', aiHrs: 37.8 },
  { name: 'Sajeev Raj', team: 'IT Security & Governance', aiHrs: 37.4 },
  { name: 'Laurence De Ocampo', team: 'Product Development', aiHrs: 35.3 },
  { name: 'Muppala Sahithi', team: 'TCoE', aiHrs: 33.1 },
  { name: 'Vijayaraj Rangasamy', team: 'MSO - Infra & AIOps', aiHrs: 32.7 },
  { name: 'Nikhithareddy Mandala', team: 'Salesforce Practice', aiHrs: 32.0 },
  { name: 'Jessieka J', team: 'TCoE', aiHrs: 31.9 },
];

const FIRST = ['Aarav','Anita','Arjun','Bao','Chen','Deepa','Divya','Farid','Hana','Hafiz','Imran','Isha','Jia','Karthik','Kavya','Lakshmi','Lina','Mai','Meera','Minh','Nadia','Naveen','Nur','Pooja','Priya','Rahul','Rajesh','Ravi','Rohan','Sanjay','Sara','Shreya','Siva','Sneha','Suresh','Tanvi','Thanh','Vikram','Wei','Yusuf','Zainab','Aditi','Bharath','Hoang','Ain','Faizal','Gopal','Joel','Kiran','Mohan'];
const LAST = ['Nair','Iyer','Tan','Lim','Nguyen','Reddy','Rao','Kumar','Sharma','Abdullah','Rahman','Pillai','Menon','Tran','Le','Wong','Patel','Das','Krishnan','Ibrahim','Joshi','Hassan','Chua','Pham','Singh','Mohan','Gupta','Ong','Raj','Bose'];

/* ---------- calendar ---------- */
const START = '2026-03-17';
const END = '2026-09-16';
const HOLIDAYS = new Set(['2026-05-01']);
function workingDays(): string[] {
  const out: string[] = [];
  const d = new Date(START + 'T00:00:00Z');
  const e = new Date(END + 'T00:00:00Z');
  while (d <= e) {
    const wd = d.getUTCDay();
    const iso = d.toISOString().slice(0, 10);
    if (wd !== 0 && wd !== 6 && !HOLIDAYS.has(iso)) out.push(iso);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
const MONTH_FACTOR: Record<string, number> = { '03': 0.99, '04': 1.0, '05': 0.99, '06': 1.04, '07': 1.01, '08': 1.01, '09': 0.98 };

/* ---------- app catalogue ---------- */
interface AppSpec { name: string; kind: 'app' | 'url'; p: Productivity; cat: string; w: number }
const A = (name: string, w: number, p: Productivity = 'productive', cat = 'Work tools'): AppSpec =>
  ({ name, w, p, cat, kind: /\.(com|ai|net|microsoft|org|io)$/.test(name) || name.includes('.com') ? 'url' : 'app' });

const COMMON: AppSpec[] = [
  A('Microsoft Teams', 0.41, 'productive', 'Communication'),
  A('Google Chrome', 0.07, 'neutral', 'Browser'),
  A('Microsoft Edge', 0.05, 'neutral', 'Browser'),
  A('Windows Explorer', 0.03, 'neutral', 'System'),
  A('teams.microsoft.com', 0.036, 'productive', 'Communication'),
  A('Microsoft Outlook', 0.022, 'productive', 'Communication'),
  A('outlook.cloud.microsoft', 0.016, 'productive', 'Communication'),
  A('teams.cloud.microsoft', 0.014, 'productive', 'Communication'),
  A('Microsoft Excel', 0.014, 'productive', 'Office'),
  A('Microsoft Word', 0.008, 'productive', 'Office'),
  A('Microsoft PowerPoint', 0.006, 'productive', 'Office'),
  A('app.briohr.com', 0.0098, 'productive', 'HR'),
  A('aventragroupcom-my.sharepoint.com', 0.009, 'productive', 'Documents'),
  A('windows.cloud.microsoft', 0.0087, 'productive', 'Office'),
  A('Notepad', 0.006, 'neutral', 'System'),
  A('Snipping Tool', 0.003, 'neutral', 'System'),
  A('ntp.msn.com', 0.0018, 'unproductive', 'News'),
  A('www.linkedin.com', 0.0011, 'unproductive', 'Professional network'),
  A('www.ndtv.com', 0.00015, 'unproductive', 'News'),
];
const GROUP_APPS: Record<Group, AppSpec[]> = {
  dev: [A('lloydsregistergroup.visualstudio.com', 0.07), A('dev.azure.com', 0.033), A('Microsoft Visual Studio 2022', 0.028), A('ServiceStudio', 0.025), A('Visual Studio Code', 0.02), A('lloydsregistergroup-my.sharepoint.com', 0.014)],
  ops: [A('Remote Desktop', 0.11), A('sdp.aventragroup.com', 0.06), A('portal.azure.com', 0.02), A('lloydsregistergroup.visualstudio.com', 0.02)],
  sf: [A('lloydsreg--uat.sandbox.lightning.force.com', 0.06), A('Visual Studio Code', 0.04), A('lloydsreg-lex.lightning.force.com', 0.01, 'unproductive', 'CRM'), A('dev.azure.com', 0.02)],
  sap: [A('SAP Logon', 0.12), A('Remote Desktop', 0.05)],
  fin: [A('books.zoho.com', 0.045, 'unproductive', 'Accounting'), A('www2.secure.hsbcnet.com', 0.01, 'unproductive', 'Banking'), A('Microsoft Excel', 0.1)],
  people: [A('www.linkedin.com', 0.025, 'unproductive', 'Professional network'), A('app.briohr.com', 0.06)],
  biz: [A('lloydsreg-lex.lightning.force.com', 0.02, 'unproductive', 'CRM'), A('Microsoft PowerPoint', 0.05), A('www.linkedin.com', 0.012, 'unproductive', 'Professional network')],
};
const AI_SITES: { tool: string; site: string; p: number }[] = [
  { tool: 'Microsoft 365 Copilot', site: 'm365.cloud.microsoft', p: 0.85 },
  { tool: 'Microsoft Copilot', site: 'copilot.microsoft.com', p: 0.5 },
  { tool: 'ChatGPT', site: 'chatgpt.com', p: 0.255 },
  { tool: 'Claude', site: 'claude.ai', p: 0.21 },
  { tool: 'Gemini', site: 'gemini.google.com', p: 0.1 },
  { tool: 'NotebookLM', site: 'notebooklm.google.com', p: 0.066 },
  { tool: 'DeepSeek', site: 'chat.deepseek.com', p: 0.013 },
  { tool: 'Perplexity', site: 'www.perplexity.ai', p: 0.011 },
  { tool: 'Grok', site: 'grok.com', p: 0.011 },
  { tool: 'Blackbox AI', site: 'www.blackbox.ai', p: 0.005 },
  { tool: 'Qwen', site: 'chat.qwen.ai', p: 0.005 },
];
const AI_MONTH: Record<string, number> = { '03': 0.5, '04': 0.88, '05': 0.8, '06': 0.99, '07': 1.05, '08': 0.91, '09': 0.51 };
const NONWORK: { name: string; cat: string; w: number }[] = [
  { name: 'www.youtube.com', cat: 'Video / streaming', w: 0.35 },
  { name: 'www.netflix.com', cat: 'Video / streaming', w: 0.08 },
  { name: 'www.facebook.com', cat: 'Social media', w: 0.15 },
  { name: 'www.tiktok.com', cat: 'Social media', w: 0.08 },
  { name: 'www.instagram.com', cat: 'Social media', w: 0.08 },
  { name: 'www.crazygames.com', cat: 'Gaming', w: 0.1 },
  { name: 'Steam', cat: 'Gaming', w: 0.06 },
  { name: 'Gambling site (masked)', cat: 'Gambling', w: 0.01 },
];

/* ---------- build ---------- */
function build(): Dataset {
  const days = workingDays();
  const months = Array.from(new Set(days.map((d) => d.slice(0, 7))));
  const employees: Employee[] = [];
  const daily: DailyRecord[] = [];
  const appUsage: AppUsageRecord[] = [];
  const usedNames = new Set<string>();
  const teamByName = new Map(TEAMS.map((t) => [t.team, t]));
  const namedByTeam = new Map<string, Named[]>();
  NAMED.forEach((n) => namedByTeam.set(n.team, [...(namedByTeam.get(n.team) ?? []), n]));

  let idx = 0;
  let adultLeft = 3;
  for (const spec of TEAMS) {
    const named = namedByTeam.get(spec.team) ?? [];
    for (let i = 0; i < spec.n; i++) {
      idx++;
      const nm = named[i];
      let name = nm?.name;
      while (!name || (usedNames.has(name) && !nm)) name = `${pick(FIRST)} ${pick(LAST)}`;
      usedNames.add(name);
      const id = `E${String(idx).padStart(4, '0')}`;
      const late = !nm && rnd() < 0.08;                       // joined mid-period
      const joinIdx = late ? Math.floor(rnd() * 90) + 20 : 0;
      employees.push({ id, name, department: spec.dept, team: spec.team, joinDate: days[joinIdx] });

      const mean = nm?.avg ?? clamp(spec.mean * logn(0.34), 0.25, 7.6);
      const presence = nm?.days ? nm.days / days.length : clamp(0.76 + 0.2 * normal(), 0.15, 0.99);
      const gap = clamp(4.2 + 0.9 * normal(), 1.5, 7);
      const pShare = clamp(spec.comp[0] / 100 + 0.04 * normal(), 0.5, 0.99);
      const uShare = clamp((spec.comp[2] / 100) * logn(0.6), 0, 0.3);

      const monthActive: Record<string, number> = {};
      days.forEach((date, di) => {
        if (di < joinIdx) return;
        const present = rnd() < presence;
        if (!present) {
          daily.push({ employeeId: id, date, present: false, onlineSec: 0, activeSec: 0, productiveSec: 0, neutralSec: 0, unproductiveSec: 0 });
          return;
        }
        const mf = MONTH_FACTOR[date.slice(5, 7)] ?? 1;
        const act = clamp(mean * mf * logn(0.35), 0, 10.5);
        const onl = clamp(act + gap + 0.8 * normal(), act, 12.5);
        const prod = act * pShare;
        const unp = Math.min(act - prod, act * uShare);
        const s = (h: number) => Math.round(h * 3600);
        daily.push({
          employeeId: id, date, present: true, onlineSec: s(onl), activeSec: s(act), productiveSec: s(prod),
          unproductiveSec: s(unp), neutralSec: Math.max(0, s(act) - s(prod) - s(unp)), spanSec: s(onl + 0.6 + rnd()),
        });
        const m = date.slice(0, 7);
        monthActive[m] = (monthActive[m] ?? 0) + act;
      });

      /* app usage, monthly buckets */
      const catalogue = [...COMMON, ...GROUP_APPS[spec.group]];
      const wsum = catalogue.reduce((a, c) => a + c.w, 0);
      const personW = catalogue.map((c) => c.w * logn(0.5));
      const isAdopter = !nm?.noAI && (nm?.aiHrs ? true : rnd() < 0.86);
      const tools = isAdopter ? AI_SITES.filter((t) => rnd() < t.p) : [];
      if (isAdopter && tools.length === 0) tools.push(AI_SITES[0]);
      const aiTotal = nm?.aiHrs ?? (isAdopter ? 7.2 * logn(1.1) : 0);
      const touchesNonWork = !nm?.unprod && rnd() < 0.5;
      const heavy = touchesNonWork && rnd() < 0.03;
      const nwTotal = touchesNonWork ? (heavy ? 10 + rnd() * 25 : 0.6 * logn(1.0)) : 0;
      const nwItem = pick(NONWORK.flatMap((x) => Array(Math.round(x.w * 100)).fill(x)) as typeof NONWORK);
      const isAdult = touchesNonWork && adultLeft > 0 && rnd() < 0.02;
      if (isAdult) adultLeft--;
      const activeMonths = months.filter((m) => monthActive[m]);
      const totalActive = activeMonths.reduce((a, m) => a + monthActive[m], 0) || 1;

      for (const m of activeMonths) {
        const date = `${m}-01`;
        const hrs = monthActive[m];
        const share = hrs / totalActive;
        const sumW = personW.reduce((a, b) => a + b, 0);
        catalogue.forEach((c, ci) => {
          const h = hrs * (personW[ci] / sumW) * wsum * 1.35;
          if (h < 0.05) return;
          appUsage.push({ employeeId: id, date, name: c.name, kind: c.kind, productivity: c.p, category: c.cat, activeSec: Math.round(h * 3600) });
        });
        // AI usage
        if (tools.length) {
          const mAi = aiTotal * share * (AI_MONTH[m.slice(5)] ?? 1);
          if (rnd() < 0.72 || nm?.aiHrs) {
            const tw = tools.map((t, ti) => (ti === 0 ? 2 : 1) * logn(0.5));
            const tws = tw.reduce((a, b) => a + b, 0);
            tools.forEach((t, ti) => {
              const h = mAi * (tw[ti] / tws);
              if (h < 0.01) return;
              appUsage.push({ employeeId: id, date, name: t.site, kind: 'url', productivity: 'productive', category: 'AI assistant', activeSec: Math.round(h * 3600) });
            });
          }
        }
        // non-work
        if (touchesNonWork && rnd() < 0.7) {
          appUsage.push({ employeeId: id, date, name: nwItem.name, kind: nwItem.name.includes('.') ? 'url' : 'app', productivity: 'unproductive', category: nwItem.cat, activeSec: Math.round(nwTotal * share * 3600) });
        }
        if (isAdult) appUsage.push({ employeeId: id, date, name: 'Adult site (masked)', kind: 'url', productivity: 'unproductive', category: 'Adult', activeSec: Math.round(1.25 * share * 3600) });
        if (nm?.unprod) {
          const known = [...COMMON, ...Object.values(GROUP_APPS).flat()].find((x) => x.name === nm.unprod!.item);
          const nw = NONWORK.find((x) => x.name === nm.unprod!.item);
          appUsage.push({
            employeeId: id, date, name: nm.unprod.item, kind: nm.unprod.item.includes('.') ? 'url' : 'app', productivity: 'unproductive',
            category: nw?.cat ?? known?.cat ?? 'Gaming', activeSec: Math.round(nm.unprod.hrs * share * 3600),
          });
        }
      }
    }
  }
  void teamByName;
  // a few admin/test accounts the deck excluded
  for (let i = 0; i < 5; i++) employees.push({ id: `T${i}`, name: `Test account ${i + 1}`, department: 'Default', team: 'Default', excluded: true });
  return { config: clientConfig, employees, daily, appUsage };
}

export const mockDataset: Dataset = build();
