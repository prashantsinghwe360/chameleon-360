/* =====================================================================
 * DATA CONTRACT
 * ---------------------------------------------------------------------
 * Every client is loaded into this one shape. The dashboard never reads
 * a client-specific field: it computes every number on screen from these
 * three raw tables + the client config. To onboard a new client you only
 * write an adapter (export -> Dataset). See src/data/adapter.ts.
 * ===================================================================== */

/** ISO date "YYYY-MM-DD" */
export type ISODate = string;

/** One row per tracked person (snapshot of the org hierarchy). */
export interface Employee {
  id: string;
  name: string;
  department: string;          // "Default" / "Unassigned" allowed
  team: string;                // sub-group; equal to department if none
  designation?: string;        // optional - deck had none
  location?: string;
  joinDate?: ISODate;          // optional - enables join-month cohorts
  excluded?: boolean;          // test / admin accounts
}

/**
 * One row per person per WORKING day in the review window
 * (the "activity ledger"). Days with no punch/online signal are kept with
 * present=false so coverage can be measured; they are never counted as zero.
 * All durations are in SECONDS.
 */
export interface DailyRecord {
  employeeId: string;
  date: ISODate;
  present: boolean;            // punch or online signal exists
  onlineSec: number;           // logged-in time
  activeSec: number;           // keyboard / mouse activity
  productiveSec: number;       // active time on productive-tagged apps/urls
  neutralSec: number;
  unproductiveSec: number;
  spanSec?: number;            // punch-in -> punch-out (for capacity lens)
}

export type Productivity = 'productive' | 'neutral' | 'unproductive';

/**
 * App / website usage, pre-aggregated per person per PERIOD BUCKET
 * (bucket = first day of the month in the mock; a day or week also works -
 * the period filter matches on `date`).
 */
export interface AppUsageRecord {
  employeeId: string;
  date: ISODate;               // bucket start
  name: string;                // "Microsoft Teams" or "www.youtube.com"
  kind: 'app' | 'url';
  productivity: Productivity;  // the client's own tagging
  category: string;            // e.g. "Communication", "Gaming", "AI assistant"
  activeSec: number;
}

/** Client-level rules. Everything a business analyst used to decide by hand. */
export interface ClientConfig {
  clientName: string;
  vendorName: string;
  /** Apps/urls hidden from "top apps" (generic browser chrome, file explorer). */
  excludeFromTopApps: string[];
  /** Categories counted as non-work screening. */
  nonWorkCategories: string[];
  /** AI tool -> name patterns (lower-case substring match on usage `name`). */
  aiTools: Record<string, string[]>;
  /** An AI "hub" that also launches other apps - reported with and without. */
  aiHubTool?: string;
  /** Minimum present days before a person appears in individual lists. */
  minPresentDaysForLists: number;
  /** Groups with fewer people are hidden from department / team charts. */
  minGroupSize: number;
  /** Default thresholds (all editable in the UI). */
  defaults: {
    underThreshold: Threshold;        // overview "under-utilised"
    individualsThreshold: Threshold;  // people page list
    redFlag: RedFlagConfig;
    bands: { metric: MetricKey; low: number; high: number }; // wellness bands
    leaderCount: number;              // top / bottom N teams
    aiPowerUserCount: number;
  };
  /** Label for the unassigned department, if the client has one. */
  unassignedDepartment?: string;
}

/* ------------------------- filter primitives ------------------------- */

/** The three per-day time metrics a user can switch between. */
export type MetricKey = 'active' | 'productive' | 'online';

export type Comparator = '<' | '<=' | '>' | '>=';

/** "active hours < 3" - a reusable metric + operator + value. */
export interface Threshold {
  metric: MetricKey;
  op: Comparator;
  value: number;               // hours / present day
}

/** Every person-level measure a red-flag rule can use. Extend freely. */
export type PersonMeasure =
  | 'avgActive' | 'avgProductive' | 'avgOnline'
  | 'productivePct' | 'unproductiveHrs' | 'nonWorkHrs'
  | 'aiHrs' | 'pctDaysUnder' | 'presentDays';

export interface RedFlagRule {
  id: string;
  measure: PersonMeasure;
  op: Comparator;
  value: number;
  enabled: boolean;
}

export interface RedFlagConfig {
  combine: 'all' | 'any';      // AND / OR across enabled rules
  minPresentDays: number;
  rules: RedFlagRule[];
}

export type PeriodKey = '1m' | '3m' | '6m' | '1y';

export interface Dataset {
  config: ClientConfig;
  employees: Employee[];
  daily: DailyRecord[];
  appUsage: AppUsageRecord[];
}
