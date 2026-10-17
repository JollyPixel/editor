// Import Node.js Dependencies
import type { RecordableHistogram } from "node:perf_hooks";

export const SCENARIOS = ["presence", "command", "churn"] as const;

export type Scenario = typeof SCENARIOS[number];

export interface LoadServerConfig {
  rooms: number;
  variants: number;
  snapshotBytes: number;
  compression: boolean;
  rights: boolean;
}

export interface ServerSample {
  cpuMs: number;
  elu: number;
  loopDelayP99Ms: number;
  heapUsedMb: number;
  rssMb: number;
  gcCount: number;
  gcPauseMs: number;
}

export type ServerCommand =
  | { type: "mark"; }
  | { type: "sample"; };

export type ServerEvent =
  | { type: "listening"; port: number; }
  | { type: "sample"; sample: ServerSample; };

export interface Workload {
  scenario: Scenario;
  rooms: number;
  rate: number;
  variants: number;
}

export interface DriverInit {
  url: string;
  workload: Workload;
  clientIndices: number[];
  totalClients: number;
}

export interface DriverReport {
  own: RecordableHistogram;
  peer: RecordableHistogram;
  sent: number;
  received: number;
  bytes: number;
  missed: number;
  elu: number;
}

export type DriverCommand =
  | { type: "run"; }
  | { type: "pause"; }
  | { type: "reset"; }
  | { type: "report"; }
  | { type: "close"; };

export type DriverEvent =
  | { type: "ready"; }
  | { type: "report"; report: DriverReport; };

export function roomName(
  index: number
): string {
  return `room-${index}`;
}
