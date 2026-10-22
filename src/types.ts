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
    /** daily capacity benchmark: hours per present day on a metric, +/- variance % = healthy band */
    capacity: CapacityConfig;
    insightRules: InsightRulesConfig;
    /** cohorts available out of the box; users can add, edit and delete in the Cohorts tab */
    cohorts: CohortDef[];
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

export type PageKey = 'overview' | 'teams' | 'capacity' | 'cohorts' | 'ai' | 'apps' | 'data';

/* ------------------------------ insights ------------------------------ */
export type InsightTone = 'priority' | 'opportunity' | 'maintain';
export interface Insight {
  /** stable rule id, e.g. 'act.mapping' */
  id?: string;
  tone: InsightTone;
  title: string;
  body: string;
  link?: { page: PageKey; anchor: string };
  /** headline number shown on the right of the row, e.g. { value: '5,491h', label: 'spent so far' } */
  metric?: { value: string; label: string };
  /** pages this insight is shown on (Overview shows only 'priority') */
  pages?: PageKey[];
}

/** Thresholds for the decision rules. Every number is editable per client. */
export interface InsightRulesConfig {
  // Act now
  mappingHrsPerDay: number;          // unproductive work-tool item used > N h per working day
  lowActiveHrs: number;              // people averaging active < N h/day
  lowOnlineHrs: number;              // presence gap: online < N h on a present day ...
  lowOnlineMinDays: number;          // ... on at least N days
  neutralHrs: number;                // team neutral > N h/day and productive < neutral
  underBandSharePct: number;         // underutilised people > N% of headcount
  severeCategories: string[];        // any time in these = act now
  // Opportunity
  leisureCategories: string[];       // video / social
  leisureMinHrs: number;             // leisure between min ...
  leisureMaxHrs: number;             // ... and max h per present day
  aiMaxHrs: number;                  // AI use > 0 and < N h per present day
  healthySharePct: number;           // healthy people < N% of headcount
  lowProductiveHrs: number;          // productive < N h/day ...
  minOnlineHrs: number;              // ... while online > N h/day
  overDaysSharePct: number;          // overburdened on > N% of present days
  minPresentDaysForDayShare: number; // ... with more than N present days
  // Keep as is
  leisureKeepHrs: number;            // total leisure hours < N in the period
  overDaysKeepRangePct: [number, number];
  monthlyChangePct: number;          // month-on-month change below N%
  unproductiveSharePct: number;      // unproductive time < N% of tracked time
}

/** Daily capacity benchmark: hours per present day on a metric, +/- variance % = healthy band. */
export interface CapacityConfig { metric: MetricKey; benchmark: number; variancePct: number }

/* ------------------------------ custom cohorts ------------------------------ */

/** What a cohort rule can test. Time metrics are hours per present day; usage is hours in the period. */
export type CohortMeasure =
  | 'active' | 'productive' | 'online' | 'idle'   // hrs / present day (idle = online - active)
  | 'category'                                      // hrs in a chosen app/website category
  | 'unproductiveHrs' | 'nonWorkHrs' | 'aiHrs'      // hrs in the period
  | 'productivePct' | 'presentDays';

export interface CohortRule {
  id: string;
  measure: CohortMeasure;
  /** only for measure 'category' */
  category?: string;
  mode: 'min' | 'max' | 'range';   // at least / at most / between
  min?: number;
  max?: number;
}

/** A named, rule-based group of people, e.g. "Red flag" or "Idle-heavy". */
export interface CohortDef {
  id: string;
  name: string;
  color: string;
  combine: 'all' | 'any';
  rules: CohortRule[];
  description?: string;
}

export interface Dataset {
  config: ClientConfig;
  employees: Employee[];
  daily: DailyRecord[];
  appUsage: AppUsageRecord[];
}
