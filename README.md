# We360 Executive Workforce Dashboard

React + TypeScript executive dashboard built from the Client Review Deck (17 Mar – 16 Sep 2026).
Every number is computed from raw data, so the same dashboard works for any client.

## Run

```bash
npm install
npm run dev        # local dev server
npm run build      # typecheck + single-file build in dist/index.html
```

## Pages

| Tab | Deck slides | Highlights |
|---|---|---|
| Overview | 2, 3, 20 | 6 clickable KPI cards (jump to the detail section), presence coverage, "where to act" insights |
| Teams & cohorts | 4, 5, 7, 8, 18 | Department patterns, monthly/weekly trend, composition, leading vs lagging (top/bottom N), cohort explorer |
| AI adoption | 14, 15, 16 | Adoption with/without hub tool, users by tool, non-AI people, power users, monthly trend |
| Apps & websites | 9, 10, 13 | Top apps & sites, top 10 productive/unproductive with mis-tag detection, non-work screening |
| People | 6, 11, 12 | Threshold list (metric + operator + value), unproductive visitors, red-flag rule builder |
| Data & settings | – | Loaded dataset, client rules, data contract |

The period filter (last 1 / 3 / 6 months / 1 year) in the top bar applies to every page.

## Project structure

```
src/
  types.ts              Data contract (Employee, DailyRecord, AppUsageRecord, ClientConfig)
  data/clientConfig.ts  Per-client rules: excluded apps, non-work categories, AI tools, defaults
  data/adapter.ts       Template: map a client's raw export into a Dataset
  data/mockData.ts      Seeded sample data calibrated to the deck (replace with a real adapter)
  lib/metrics.ts        Metric engine – every number on screen is computed here
  lib/insights.ts       Data-driven decision insights (wording adapts to any client)
  state.tsx             Shared state: period, thresholds, red-flag rules, navigation
  components/ui.tsx     Cards, KPI, insight panel, threshold control, sortable table
  pages/                One file per tab
  styles.css            Theme tokens at the top – re-brand per client here
```

## Onboarding a new client

1. Copy `data/clientConfig.ts` and set the client's rules.
2. Map their exports with `buildDataset()` in `data/adapter.ts`.
3. Render `<App dataset={yourDataset} />`.

No page code changes are needed.

## Data contract (summary)

- **Employee** – id, name, department, team, designation?, joinDate?, excluded?
- **DailyRecord** – one row per person per working day, *including* days with no signal (`present: false`), with online / active / productive / neutral / unproductive seconds. Hours are averaged over present days only.
- **AppUsageRecord** – app or URL time per person per bucket (day, week or month), with the client's productivity tag and category.

## Red flags

Rules live in `ClientConfig.defaults.redFlag` and can be edited in the UI (People → Red flags). Any measure in `PersonMeasure` can be used; add new measures in `types.ts` and `measureOf()` in `lib/metrics.ts`.
