# Chameleon 360 · We360 Executive Workforce Dashboard

React + TypeScript executive dashboard built from the Client Review Deck (17 Mar – 16 Sep 2026).
Every number is computed from raw data, so the same dashboard works for any client.

## Run

```bash
npm install
npm run dev        # local dev server
npm run build      # typecheck + single-file build in dist/index.html
npm run data:demo  # regenerate data/demo-client/ (only needed for the demo)
```

## Pages

Formulas, decision rules and how the tabs link together are documented in **[docs/LOGIC.md](docs/LOGIC.md)**.

All tabs sit under **Executive Dashboard** in the sidebar.

| Tab | Deck slides | Highlights |
|---|---|---|
| Overview | 2, 3, 20 | 6 clickable KPI cards, presence coverage reconciled to people tracked (person-days + people by presence rate), "where to act" insights |
| Teams | 4, 5, 7, 8 | Department-wise activity patterns with a dashed baseline at the set hours; its detail page holds the team leaderboard (ranked by the graph's metric, top/bottom N, by department or team); monthly/weekly trend; composition |
| Time & Capacity | 17 | Daily capacity benchmark (default avg online 7h ±10% → healthy 6.3–7.7h): ideal capacity = headcount × working days × benchmark vs actual, people split underutilised / healthy / overburdened, capacity by department with healthy band + benchmark line, where the working day goes |
| Cohorts | 6, 11, 12, 18 | Rule-based cohort builder, compare cohorts, member detail pages, people below a threshold, unproductive visitors, red flags, built-in groupings |
| AI adoption | 14, 15, 16 | Adoption, users by tool (tooltip: users + total time on tool), no-AI people (with avg online), monthly trend, power users graph |
| Apps & websites | 9, 10, 13 | Category filter (top bar, or click a category bar) that re-scopes the whole tab; non-work screening, top apps & sites, top 10 productive/unproductive |
| Data & settings | – | Loaded dataset, client rules, data contract |

The team filter (all teams or one team; with one team selected every department-level chart and table switches to one row per person), the category filter (Apps & websites only) and the period filter (last 1 / 3 / 6 months / 1 year) in the top bar apply to every page.

## Project structure

```
data/
  README.md             CSV formats and how to add a client
  we360-sample/         default client, converted from source/We360_Sample_Workforce_Data_v2.xlsx
  demo-client/          deck-calibrated demo (open with ?client=demo-client)
scripts/                import_workbook.py (xlsx → client folder), demo-data generator (npm run data:demo)
src/
  types.ts              Data contract (Employee, DailyRecord, AppUsageRecord, ClientConfig)
  data/loadDataset.ts   Picks the client folder, parses the CSVs, merges client_config.json with defaults
  data/adapter.ts       CSV columns → data contract (edit COLUMNS for other export formats)
  data/clientConfig.ts  Default rules, used for anything a client's JSON leaves out
  lib/csv.ts            CSV parser
  lib/metrics.ts        Metric engine – every number on screen is computed here
  lib/insightRules.ts   Act now / Opportunity / Keep as is rules
  theme/tokens.ts       We360 Design System tokens
  state.tsx             Shared state: period, team, thresholds, cohorts, navigation
  components/ui.tsx     Cards, KPI, insight panel, controls, table
  pages/                One file per tab
  styles.css            Design tokens as CSS variables + component styles
```

## Onboarding a new client

1. Add a folder `data/<client-id>/` with `employees.csv`, `daily_activity.csv`, `app_usage.csv`
   (formats in [data/README.md](data/README.md)).
2. Optionally add `client_config.json` with the client's name, non-work categories, AI tools, capacity benchmark and rule thresholds.
3. Open the dashboard with `?client=<client-id>` (or build with `VITE_CLIENT=<client-id>`).

No code changes are needed. If a client's export uses different column names, edit `COLUMNS` in `src/data/adapter.ts`.

## Data contract (summary)

- **Employee** – id, name, department, team, designation?, joinDate?, excluded?
- **DailyRecord** – one row per person per working day, *including* days with no signal (`present: false`), with online / active / productive / neutral / unproductive seconds. Hours are averaged over present days only.
- **AppUsageRecord** – app or URL time per person per bucket (day, week or month), with the client's productivity tag and category.

These are loaded from the CSVs in `data/<client-id>/`; see [data/README.md](data/README.md).

## Red flags

Rules live in `ClientConfig.defaults.redFlag` and can be edited in the UI (People → Red flags). Any measure in `PersonMeasure` can be used; add new measures in `types.ts` and `measureOf()` in `lib/metrics.ts`.

## Design system

Built on the We360 Design System: Lato (400 / 700 / 900, bundled via `@fontsource/lato`), Deep Indigo nav,
Slate Purple `#7B61FF` primary, slate neutrals and canvas `#EFF1F5`.

Chart colours follow the system's data rules:

| Meaning | Token |
|---|---|
| Online / Active / Productive / Unproductive / Neutral | Analytics series (Lavender light, Blue, Green, Brink, Slate 400) |
| Under-utilised / Healthy / Overburdened | Wellness (Coral Red, Teal Green, Amber) |
| AI usage | Lavender (users line Cyan) |
| Likely mis-tagged work tool | Amber |
| Act now / Opportunity / Keep as is | Error / Warning / Success signals (feedback only, never a data series) |

## Cohorts

A cohort is a named set of rules, e.g. **Red flag** = active time/day ≤ 2h **and** present days ≥ 50.
Each rule picks a measure, a condition (at least / at most / between) and values:

- time per present day: active, productive, online, idle (online − active)
- usage in the period: a chosen unproductive or non-work category, all unproductive, all non-work, AI tools
- productive share of active time, present days

Presets ship in `clientConfig.defaults.cohorts`; users can add, edit and delete cohorts in the Cohorts tab.
Rules are evaluated live on the selected period and team (`cohortMembers()` in `lib/metrics.ts`).

## Capacity benchmark

Set per client in `clientConfig.defaults.capacity` (`metric`, `benchmark` hours/day, `variancePct`) and editable on the Time & Capacity tab.

- Healthy band = benchmark × (1 ± variance). Below = underutilised, above = overburdened (wellness colours).
- Ideal capacity = headcount × working days in the period × benchmark. Working days are counted from the client's ledger, so holidays are excluded automatically.

## Decision rules ("Act now" / "Opportunity" / "Keep as is")

`src/lib/insightRules.ts` evaluates 16 rules on the selected period and team. A rule only appears when its condition
holds; all thresholds live in `clientConfig.defaults.insightRules` (and the capacity benchmark).

| Tone | Rule | Shown on |
|---|---|---|
| Act now | Apps / URLs needing category mapping, used > 1h per working day (total hours to date) | Overview, Apps |
| Act now | People averaging active < 2h/day | Overview, Cohorts |
| Act now | Presence gap: online < 1h on 3+ present days | Overview, Time & Capacity |
| Act now | Teams with productive < neutral and neutral > 2h/day (total neutral hours to date) | Overview, Teams |
| Act now | Underutilised band > 50% of headcount | Overview, Time & Capacity |
| Act now | Any time on gaming, adult or gambling | Overview, Apps |
| Opportunity | Video / social between 1h and 3h per present day | Apps |
| Opportunity | AI use > 0 and < 1h per present day | AI adoption |
| Opportunity | Healthy band < 50% of headcount (with under / over shares) | Time & Capacity |
| Opportunity | Productive < 3h/day while online > 3h/day | Cohorts, Teams |
| Opportunity | Overburdened on > 50% of present days (7+ days) | Time & Capacity |
| Keep as is | Video / social total < 10h in the period (period ≥ 1 month) | Apps |
| Keep as is | Overburdened on 30–50% of present days (7+ days) | Time & Capacity |
| Keep as is | Activity % (active ÷ online) month-on-month change < 20% | Teams |
| Keep as is | Attendance % month-on-month change < 20% | Teams, Time & Capacity |
| Keep as is | Unproductive apps < 5% of tracked time | Apps |

Overview shows only the Act now rules, at the end of the page. Every other tab shows its rules in the collapsible panel.
