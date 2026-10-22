/// <reference types="vite/client" />
interface ImportMetaEnv {
  /** client folder under data/ to load by default, e.g. "demo-client" */
  readonly VITE_CLIENT?: string;
  /** optional: load data at runtime from this URL (e.g. https://cdn.example.com/data) instead of bundling it */
  readonly VITE_DATA_BASE_URL?: string;
}
