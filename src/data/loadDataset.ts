/* =====================================================================
 * DATA LOADER - reads one client's folder from data/<client-id>/:
 *   employees.csv, daily_activity.csv, app_usage.csv, client_config.json
 * ---------------------------------------------------------------------
 * Which client:  ?client=<id> in the URL  >  VITE_CLIENT  >  data/clients.json "default"  >  first folder.
 * Where from:    bundled at build time (default), or fetched at runtime
 *                from VITE_DATA_BASE_URL/<client-id>/... when that is set.
 * ===================================================================== */
import type { ClientConfig, Dataset } from '../types';
import { parseCsv } from '../lib/csv';
import { buildDataset, DatasetError } from './adapter';
import { clientConfig as defaultConfig } from './clientConfig';

export const FILES = ['employees.csv', 'daily_activity.csv', 'app_usage.csv', 'client_config.json'] as const;

// every file in data/*/ is bundled as text at build time
const bundled = import.meta.glob('/data/*/*.{csv,json}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Client folders available in the bundle. */
export const bundledClients = [...new Set(Object.keys(bundled).map((p) => p.split('/')[2]))].sort();

export interface LoadedDataset { dataset: Dataset; clientId: string; source: string; rows: Record<string, number> }

/** Client config from JSON, filled in with the defaults for anything it leaves out. */
function mergeConfig(json: Partial<ClientConfig>): ClientConfig {
  const d = defaultConfig.defaults;
  const j = json.defaults ?? ({} as Partial<ClientConfig['defaults']>);
  return {
    ...defaultConfig, ...json,
    aiTools: json.aiTools ?? defaultConfig.aiTools,
    defaults: {
      ...d, ...j,
      redFlag: { ...d.redFlag, ...j.redFlag },
      bands: { ...d.bands, ...j.bands },
      capacity: { ...d.capacity, ...j.capacity },
      insightRules: { ...d.insightRules, ...j.insightRules },
      cohorts: j.cohorts ?? d.cohorts,
    },
  };
}

// data/clients.json names the default client (a plain file, so it survives GitHub browser uploads)
const manifest = import.meta.glob('/data/clients.json', { import: 'default', eager: true }) as Record<string, { default?: string }>;
const defaultClient = Object.values(manifest)[0]?.default;

function pickClient(): string {
  const fromUrl = new URLSearchParams(window.location.search).get('client');
  const id = fromUrl || import.meta.env.VITE_CLIENT || (defaultClient && bundledClients.includes(defaultClient) ? defaultClient : bundledClients[0]);
  if (!id) throw new DatasetError('No client data found. Add a folder under data/ with employees.csv, daily_activity.csv and app_usage.csv.');
  return id;
}

async function readFiles(clientId: string): Promise<{ texts: Record<string, string>; source: string }> {
  const base = import.meta.env.VITE_DATA_BASE_URL;
  if (base) {
    const texts: Record<string, string> = {};
    for (const f of FILES) {
      const res = await fetch(`${base.replace(/\/$/, '')}/${clientId}/${f}`);
      if (!res.ok) {
        if (f === 'client_config.json') continue; // optional
        throw new DatasetError(`Could not load ${clientId}/${f} (${res.status}).`);
      }
      texts[f] = await res.text();
    }
    return { texts, source: `${base}/${clientId}` };
  }
  if (!bundledClients.includes(clientId)) {
    throw new DatasetError(`No data folder "data/${clientId}". Available: ${bundledClients.join(', ') || 'none'}.`);
  }
  const texts = Object.fromEntries(FILES.map((f) => [f, bundled[`/data/${clientId}/${f}`]]).filter(([, t]) => t !== undefined));
  return { texts, source: `data/${clientId}` };
}

export async function loadDataset(): Promise<LoadedDataset> {
  const clientId = pickClient();
  const { texts, source } = await readFiles(clientId);
  for (const f of FILES.slice(0, 3)) if (!texts[f]) throw new DatasetError(`Missing ${source}/${f}.`);
  const config = mergeConfig(texts['client_config.json'] ? JSON.parse(texts['client_config.json']) : {});
  const employees = parseCsv(texts['employees.csv']);
  const daily = parseCsv(texts['daily_activity.csv']);
  const usage = parseCsv(texts['app_usage.csv']);
  const dataset = buildDataset(config, employees, daily, usage);
  return { dataset, clientId, source, rows: { 'employees.csv': employees.length, 'daily_activity.csv': daily.length, 'app_usage.csv': usage.length } };
}
