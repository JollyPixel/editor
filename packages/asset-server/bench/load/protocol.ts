// Import Internal Dependencies
import type { StoreKind } from "../_fixtures.ts";

export const SCENARIOS = ["edit", "join", "catalog", "http", "open"] as const;

export type Scenario = typeof SCENARIOS[number];

export interface LoadServerConfig {
  assets: number;
  grids: number;
  contentBytes: number;
  store: StoreKind;
  graceMs: number;
  snapshotDelayMs: number;
  compression: boolean;
}

export interface Workload {
  scenario: Scenario;
  grids: number;
  etag: boolean;
}
