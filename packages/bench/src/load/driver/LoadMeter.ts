// Import Node.js Dependencies
import {
  createHistogram,
  type RecordableHistogram
} from "node:perf_hooks";

export type LatencyOrigin = "own" | "peer";

export class LoadMeter {
  readonly own: RecordableHistogram = createHistogram();
  readonly peer: RecordableHistogram = createHistogram();
  sent = 0;
  received = 0;
  bytes = 0;

  record(
    origin: LatencyOrigin,
    startedAtMs: number,
    endedAtMs: number
  ): void {
    this[origin].record(
      Math.max(1, Math.round((endedAtMs - startedAtMs) * 1_000))
    );
  }

  reset(): void {
    this.own.reset();
    this.peer.reset();
    this.sent = 0;
    this.received = 0;
    this.bytes = 0;
  }
}
