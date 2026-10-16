// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  Trace,
  type TraceEvent
} from "../../perf/analysis/Trace.ts";

// CONSTANTS
const kMainThread = 1;
const kWorkerThread = 2;

describe("Trace", () => {
  test("counts each main-thread GC pause once and skips background and worker GC", () => {
    const trace = new Trace([
      threadName(kMainThread, "CrRendererMain"),
      threadName(kWorkerThread, "DedicatedWorker thread"),
      gcSpan("MajorGC", kMainThread, 1_000, 5_000),
      gcSpan("V8.GC_MARK_COMPACTOR", kMainThread, 1_000, 4_000),
      gcSpan("V8.GC_MC_INCREMENTAL", kMainThread, 2_000, 1_000),
      gcSpan("MinorGC", kMainThread, 10_000, 1_000),
      gcSpan("V8.GC_SCAVENGER", kMainThread, 20_000, 2_000),
      gcSpan("V8.GC_SCAVENGER_BACKGROUND_SCAVENGE_PARALLEL", kMainThread, 30_000, 3_000),
      gcSpan("MinorGC", kWorkerThread, 40_000, 4_000)
    ]);

    assert.deepEqual(trace.garbageCollections(), {
      minor: { count: 2, ms: 3 },
      major: { count: 1, ms: 5 }
    });
  });
});

function threadName(
  tid: number,
  name: string
): TraceEvent {
  return {
    name: "thread_name",
    ph: "M",
    ts: 0,
    pid: 1,
    tid,
    args: { name }
  };
}

function gcSpan(
  name: string,
  tid: number,
  ts: number,
  dur: number
): TraceEvent {
  return {
    name,
    cat: name.startsWith("V8.GC_") ? "disabled-by-default-v8.gc" : "v8",
    ph: "X",
    ts,
    dur,
    pid: 1,
    tid
  };
}
