// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Internal Dependencies
import {
  StatsRecorder
} from "../../src/stats/StatsRecorder.ts";
import {
  resolveMetricFormat
} from "../../src/stats/MetricDefinition.ts";
import type {
  MetricDefinition,
  MetricSource
} from "../../src/stats/index.ts";

function sourceOf(
  ...metrics: MetricDefinition[]
): MetricSource {
  return { metrics };
}

describe("StatsRecorder - sources", () => {
  it("registers every metric a source describes", () => {
    const recorder = new StatsRecorder();
    recorder.addSource(
      sourceOf(
        { id: "chunks", label: "chunks", sample: () => 2 },
        { id: "meshes", label: "meshes", sample: () => 3 }
      )
    );
    const ids = recorder.definitions.map(({ id }) => id);

    assert.ok(ids.includes("chunks"));
    assert.ok(ids.includes("meshes"));
  });

  it("releases every metric of a source at once", () => {
    const recorder = new StatsRecorder();
    const release = recorder.addSource(
      sourceOf(
        { id: "chunks", label: "chunks" },
        { id: "meshes", label: "meshes" }
      )
    );
    release();
    const ids = recorder.definitions.map(({ id }) => id);

    assert.ok(!ids.includes("chunks"));
    assert.ok(!ids.includes("meshes"));
  });

  it("registers nothing when one metric of a source collides", () => {
    const recorder = new StatsRecorder();
    recorder.addMetric({ id: "meshes", label: "meshes" });

    assert.throws(
      () => recorder.addSource(
        sourceOf(
          { id: "chunks", label: "chunks" },
          { id: "meshes", label: "meshes" }
        )
      ),
      /Stats metric already exists: meshes/
    );
    assert.ok(
      !recorder.definitions.some(({ id }) => id === "chunks")
    );
  });

  it("stops sampling a metric that was removed", () => {
    const recorder = new StatsRecorder();
    let samples = 0;
    const release = recorder.addMetric({
      id: "chunks",
      label: "chunks",
      sample: () => ++samples
    });

    release();
    recorder.begin();
    recorder.end();

    assert.equal(samples, 0);
    assert.equal(recorder.removeMetric("chunks"), false);
  });

  it("moves the revision whenever the registered metrics change", () => {
    const recorder = new StatsRecorder();
    const initial = recorder.revision;
    const release = recorder.addSource(
      sourceOf({ id: "chunks", label: "chunks" })
    );

    assert.notEqual(recorder.revision, initial);
    const added = recorder.revision;
    release();
    assert.notEqual(recorder.revision, added);

    const released = recorder.revision;
    recorder.removeMetric("absent");
    assert.equal(recorder.revision, released);
  });
});

describe("resolveMetricFormat", () => {
  it("prefers the format a definition carries", () => {
    const format = resolveMetricFormat({
      id: "chunks",
      label: "chunks",
      unit: "ms",
      format: () => "kept"
    });

    assert.equal(format(1), "kept");
  });

  it("maps a unit to its formatter", () => {
    function formatOf(
      unit: MetricDefinition["unit"]
    ): string {
      return resolveMetricFormat({ id: "a", label: "a", unit })(1234.5);
    }

    assert.equal(formatOf("count"), "1,235");
    assert.equal(formatOf("integer"), "1235");
    assert.equal(formatOf("decimal"), "1234.5");
    assert.equal(formatOf("ms"), "1234.5 ms");
    assert.equal(formatOf("percent"), "1234.5 %");
  });

  it("falls back to whole numbers when a definition names neither", () => {
    const format = resolveMetricFormat({ id: "a", label: "a" });

    assert.equal(format(1234.5), "1235");
  });
});
