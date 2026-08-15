// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Internal Dependencies
import {
  StatsRecorder
} from "../../src/stats/StatsRecorder.ts";
import {
  resolveMetricRange
} from "../../src/stats/MetricDefinition.ts";
import type {
  PerformanceMemory,
  StatsPerformance
} from "../../src/stats/builtins.ts";

class FakePerformance implements StatsPerformance {
  memory?: PerformanceMemory;
  #time = 0;

  now(): number {
    return this.#time;
  }

  advance(
    milliseconds: number
  ): void {
    this.#time += milliseconds;
  }
}

describe("StatsRecorder", () => {
  it("aggregates frame timing over a refresh window", () => {
    const clock = new FakePerformance();
    const recorder = new StatsRecorder({
      performance: clock,
      refreshInterval: 100
    });

    recorder.begin();
    clock.advance(10);
    recorder.end();
    clock.advance(70);
    recorder.begin();
    clock.advance(20);
    recorder.end();

    assert.deepEqual(recorder.snapshot(), {
      fps: 20,
      ms: 15,
      worstMs: 20
    });
    assert.deepEqual(recorder.history("fps"), [20]);
    assert.deepEqual(recorder.history("ms"), [15]);
    assert.deepEqual(recorder.history("worstMs"), [20]);
  });

  it("supports last, average and max aggregation", () => {
    const clock = new FakePerformance();
    const recorder = new StatsRecorder({
      performance: clock,
      refreshInterval: 100
    });
    recorder.addMetric({ id: "last", label: "Last" });
    recorder.addMetric({
      id: "average",
      label: "Average",
      aggregate: "average"
    });
    recorder.addMetric({ id: "max", label: "Max", aggregate: "max" });

    for (const value of [1, 2]) {
      recorder.track("last", value);
      recorder.track("average", value);
      recorder.track("max", value);
    }
    clock.advance(100);
    recorder.track("last", 3);
    recorder.track("average", 3);
    recorder.track("max", 3);
    recorder.begin();
    recorder.end();

    const snapshot = recorder.snapshot();
    assert.equal(snapshot.last, 3);
    assert.equal(snapshot.average, 2);
    assert.equal(snapshot.max, 3);
  });

  it("wraps ring buffers while preserving oldest-to-newest order", () => {
    const clock = new FakePerformance();
    const recorder = new StatsRecorder({
      performance: clock,
      refreshInterval: 10,
      historySize: 3
    });
    recorder.addMetric({ id: "value", label: "Value" });

    for (const value of [1, 2, 3, 4, 5]) {
      clock.advance(10);
      recorder.track("value", value);
      recorder.begin();
      recorder.end();
    }

    assert.deepEqual(recorder.history("value"), [3, 4, 5]);
    const copy = recorder.history("value");
    copy.push(6);
    assert.deepEqual(recorder.history("value"), [3, 4, 5]);
  });

  it("samples every pulled metric once per refresh window", () => {
    const clock = new FakePerformance();
    const recorder = new StatsRecorder({
      performance: clock,
      refreshInterval: 100
    });
    let visibleSamples = 0;
    let hiddenSamples = 0;
    recorder.addMetric({
      id: "visible",
      label: "Visible",
      sample: () => ++visibleSamples
    });
    recorder.addMetric({
      id: "hidden",
      label: "Hidden",
      sample: () => ++hiddenSamples
    });

    clock.advance(100);
    recorder.begin();
    recorder.end();

    assert.equal(visibleSamples, 1);
    assert.equal(hiddenSamples, 1);
    assert.equal(recorder.snapshot().visible, 1);
    assert.equal(recorder.snapshot().hidden, 1);
  });

  it("notifies subscribers once with the current snapshot", () => {
    const clock = new FakePerformance();
    const recorder = new StatsRecorder({
      performance: clock,
      refreshInterval: 100
    });
    const received: Array<Record<string, number>> = [];
    const unsubscribe = recorder.subscribe(
      (snapshot) => received.push(snapshot)
    );

    clock.advance(100);
    recorder.begin();
    recorder.end();

    assert.equal(received.length, 1);
    assert.deepEqual(received[0], recorder.snapshot());
    unsubscribe();
    clock.advance(100);
    recorder.begin();
    recorder.end();
    assert.equal(received.length, 1);
  });

  it("omits mb when performance.memory is unavailable", () => {
    const recorder = new StatsRecorder({
      performance: new FakePerformance()
    });

    assert.equal("mb" in recorder.snapshot(), false);
    assert.deepEqual(recorder.history("mb"), []);
  });

  it("samples mb when performance.memory is available", () => {
    const clock = new FakePerformance();
    clock.memory = { usedJSHeapSize: 4 * 1024 * 1024 };
    const recorder = new StatsRecorder({
      performance: clock,
      refreshInterval: 100
    });

    clock.advance(100);
    recorder.begin();
    recorder.end();

    assert.equal(recorder.snapshot().mb, 4);
    assert.deepEqual(recorder.history("mb"), [4]);
  });

  it("scales mb against the available heap limit", () => {
    const clock = new FakePerformance();
    clock.memory = {
      usedJSHeapSize: 4 * 1024 * 1024,
      jsHeapSizeLimit: 16 * 1024 * 1024
    };
    const recorder = new StatsRecorder({
      performance: clock
    });
    const memory = recorder.definitions.find(
      ({ id }) => id === "mb"
    );

    assert.equal(memory?.max, 16);
  });

  it("uses stable graph bounds for frame metrics", () => {
    const recorder = new StatsRecorder({
      performance: new FakePerformance()
    });
    const definitions = new Map(
      recorder.definitions.map(
        (definition) => [definition.id, definition]
      )
    );

    assert.deepEqual(
      {
        min: definitions.get("fps")?.min,
        max: definitions.get("fps")?.max
      },
      {
        min: 0,
        max: 100
      }
    );
    for (const id of ["ms", "worstMs"]) {
      assert.deepEqual(
        {
          min: definitions.get(id)?.min,
          max: definitions.get(id)?.max
        },
        {
          min: 0,
          max: 200
        }
      );
    }
  });

  it("resolves fixed and automatic graph bounds", () => {
    assert.deepEqual(
      resolveMetricRange(
        { id: "auto", label: "Auto" },
        [4, 2, 8]
      ),
      { min: 2, max: 8 }
    );
    assert.deepEqual(
      resolveMetricRange(
        { id: "fixed", label: "Fixed", min: 0, max: 10 },
        [4, 2, 8]
      ),
      { min: 0, max: 10 }
    );
  });
});
