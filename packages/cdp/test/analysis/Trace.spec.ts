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
} from "../../src/analysis/Trace.ts";

// CONSTANTS
const kMainThread = 1;
const kWorkerThread = 2;

describe("Trace", () => {
  test("counts each main-thread GC pause once and skips background and worker GC", () => {
    const trace = new Trace([
      threadName(kMainThread, "CrRendererMain"),
      threadName(kWorkerThread, "DedicatedWorker thread"),
      span("MajorGC", kMainThread, 1_000, 5_000),
      span("V8.GC_MARK_COMPACTOR", kMainThread, 1_000, 4_000),
      span("V8.GC_MC_INCREMENTAL", kMainThread, 2_000, 1_000),
      span("MinorGC", kMainThread, 10_000, 1_000),
      span("V8.GC_SCAVENGER", kMainThread, 20_000, 2_000),
      span("V8.GC_SCAVENGER_BACKGROUND_SCAVENGE_PARALLEL", kMainThread, 30_000, 3_000),
      span("MinorGC", kWorkerThread, 40_000, 4_000)
    ]);

    assert.deepEqual(trace.garbageCollections(), {
      minor: { count: 2, ms: 3 },
      major: { count: 1, ms: 5 }
    });
  });

  test("charges nested spans to their own self time and top-level spans to busy time", () => {
    const trace = new Trace([
      threadName(kMainThread, "CrRendererMain"),
      span("RunTask", kMainThread, 0, 10_000),
      span("FunctionCall", kMainThread, 2_000, 5_000),
      span("Layout", kMainThread, 3_000, 1_000),
      span("RunTask", kMainThread, 20_000, 1_000),
      span("RunTask", kWorkerThread, 0, 50_000)
    ]);
    const main = [...trace.threads()].find(({ name }) => name === "CrRendererMain");

    assert.equal(main?.busy(), 11_000);
    assert.deepEqual(
      Array.from(main?.selfTimes() ?? [], ({ key, total }) => [key, total]),
      [["RunTask", 6_000], ["FunctionCall", 4_000], ["Layout", 1_000]]
    );
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

function span(
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
