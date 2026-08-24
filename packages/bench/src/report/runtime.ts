// Import Node.js Dependencies
import { cpus } from "node:os";

// Import Internal Dependencies
import { config } from "../config.ts";

/**
 * A type keeps the implicit index signature required by `RuntimeMetadata`.
 */
export type HostMetadata = {
  node: string;
  v8: string;
  platform: string;
  cpu: string;
  timeMs: number;
  iterations: number;
  warmupTimeMs: number;
  warmupIterations: number;
};

export type RuntimeMetadata = HostMetadata & Record<string, number | string>;

export function runtimeMetadata(): HostMetadata {
  const { time, iterations, warmupTime, warmupIterations } = config();

  return {
    node: process.version,
    v8: process.versions.v8,
    platform: `${process.platform} ${process.arch}`,
    cpu: cpus()[0]?.model ?? "unknown",
    timeMs: time,
    iterations,
    warmupTimeMs: warmupTime,
    warmupIterations
  };
}
