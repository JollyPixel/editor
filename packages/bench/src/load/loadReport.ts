// Import Node.js Dependencies
import type { RecordableHistogram } from "node:perf_hooks";

// Import Internal Dependencies
import type { LoadRun } from "./runLoad.ts";

// CONSTANTS
const kBytesPerMb = 1024 * 1024;

export type LoadColumns = Record<string, string | number | boolean | null>;

export function measuredColumns(
  run: LoadRun
): LoadColumns {
  const { elapsedMs, sample, sent } = run;
  const seconds = elapsedMs / 1_000;

  return {
    "sent/s": Math.round(sent / seconds),
    "received/s": Math.round(run.received / seconds),
    "MB/s in": roundMetric(run.bytes / kBytesPerMb / seconds),
    "own p50 (ms)": latencyMs(run.own, 50),
    "own p99 (ms)": latencyMs(run.own, 99),
    "peer p50 (ms)": latencyMs(run.peer, 50),
    "peer p99 (ms)": latencyMs(run.peer, 99),
    "server cpu %": roundMetric(sample.cpuMs / elapsedMs * 100),
    "server µs/op": sent === 0 ?
      null :
      roundMetric(sample.cpuMs * 1_000 / sent),
    "server elu": roundMetric(sample.elu),
    "server loop p99 (ms)": roundMetric(sample.loopDelayP99Ms),
    "server heap (MB)": roundMetric(sample.heapUsedMb),
    "server rss (MB)": roundMetric(sample.rssMb),
    "server gc": sample.gcCount,
    "server gc pause (ms)": roundMetric(sample.gcPauseMs),
    "driver elu (max)": roundMetric(run.driverElu),
    "missed ticks": run.missed
  };
}

function latencyMs(
  histogram: RecordableHistogram,
  percentile: number
): number | null {
  return histogram.count === 0 ?
    null :
    roundMetric(histogram.percentile(percentile) / 1_000);
}

function roundMetric(
  value: number
): number {
  return Number(value.toFixed(3));
}
