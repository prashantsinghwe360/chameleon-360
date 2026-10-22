# Client data

Each client is one folder: `data/<client-id>/`. The dashboard reads it through
`src/data/loadDataset.ts` → `src/data/adapter.ts`, and every number on screen is computed from these files.

```
data/
  demo-client/
    employees.csv        required
    daily_activity.csv   required
    app_usage.csv        required
    client_config.json   optional - anything left out uses src/data/clientConfig.ts
```

**Which client is shown:** `?client=<client-id>` in the URL, else `VITE_CLIENT` at build time, else the first folder.

## employees.csv — one row per tracked person

| Column | Required | Example | Notes |
|---|---|---|---|
| Employee ID | yes | E0001 | joins the three files |
| Name | yes | Olivia Rhye | |
| Department | yes | Product Development | blank → `unassignedDepartment` from config |
| Team | | MSO - Monitoring | blank → department |
| Designation | | Engineer | |
| Joining Date | | 2026-03-17 | enables join-month cohorts |
| Excluded | | Yes / No | test / admin accounts; if the column is missing, names containing "test" or "admin" are excluded |

## daily_activity.csv — one row per person per working day

Keep days with no activity (`Present = No`) - they are needed for presence coverage and are never counted as zero hours.

| Column | Required | Example | Notes |
|---|---|---|---|
| Employee ID | yes | E0001 | |
| Date | yes | 2026-03-17 | also accepts DD/MM/YYYY |
| Present | | Yes / No | if missing: present when online time > 0 |
| Online Time | yes | 07:24:10 | HH:MM:SS, MM:SS or seconds |
| Active Time | yes | 03:12:00 | keyboard / mouse activity |
| Productive Time | yes | 02:48:00 | |
| Neutral Time | | 00:20:05 | |
| Unproductive Time | | 00:00:40 | |
| Punch Span | | 08:30:00 | punch-in to punch-out; used by Time & Capacity (falls back to online time) |

## app_usage.csv — app / website time per person per day, week or month

| Column | Required | Example | Notes |
|---|---|---|---|
| Employee ID | yes | E0001 | |
| Date | yes | 2026-03-01 | the period bucket the row covers |
| App/URL | yes | Microsoft Teams, www.youtube.com | |
| Type | | App / URL | if missing: inferred from the name |
| Productivity | yes | productive / neutral / unproductive | the client's own tagging |
| Category | | Communication, Gaming, AI assistant | blank → Uncategorised |
| Active Time | yes | 01:42:29 | |

## client_config.json — the client's rules

Same shape as `ClientConfig` in `src/types.ts`. Typical per-client settings: `clientName`, `nonWorkCategories`,
`aiTools` (name patterns per tool), `excludeFromTopApps`, `defaults.capacity` (benchmark), `defaults.insightRules`
(decision-rule thresholds) and `defaults.cohorts` (starter cohorts). Nested objects are merged with the defaults,
so a file can be as small as `{ "clientName": "Acme" }`.

## Different column names?

Edit `COLUMNS` at the top of `src/data/adapter.ts`. A missing required column stops the dashboard with a message
naming the file and column.

## Demo data

`demo-client/` is generated (calibrated to the Client Review Deck, 17 Mar – 16 Sep 2026). Regenerate with
`npm run data:demo` (source: `scripts/`).

## Large clients

Data under `data/` is bundled into the build. For many or very large clients, host the folders elsewhere and build
with `VITE_DATA_BASE_URL=https://your-host/data` - the dashboard then fetches `<url>/<client-id>/*.csv` at runtime.
GitHub's browser upload limit is 25 MB per file.
