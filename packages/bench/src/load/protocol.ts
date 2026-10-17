// Import Node.js Dependencies
import type { RecordableHistogram } from "node:perf_hooks";

// Import Internal Dependencies
import type { ServerSample } from "./ServerProbe.ts";

export type ServerCommand =
  | { type: "mark"; }
  | { type: "sample"; };

export type ServerEvent =
  | { type: "listening"; port: number; }
  | { type: "sample"; sample: ServerSample; };

export interface LoadDriverInit<TWorkload> {
  port: number;
  rate: number;
  workload: TWorkload;
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
