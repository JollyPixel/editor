// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import type { MetricDefinition } from "@jolly-pixel/ui/stats";

// Import Internal Dependencies
import { groupMetrics } from "../../src/metrics/groupMetrics.ts";

function metric(
  id: string,
  group?: string
): MetricDefinition {
  return {
    id,
    label: id,
    group
  };
}

describe("groupMetrics", () => {
  it("keeps ungrouped metrics under one nameless group", () => {
    const groups = groupMetrics([
      metric("fps"),
      metric("ms")
    ]);

    assert.equal(groups.length, 1);
    assert.equal(groups[0].title, null);
    assert.deepEqual(
      groups[0].metrics.map(({ id }) => id),
      ["fps", "ms"]
    );
  });

  it("gathers a group named more than once", () => {
    const groups = groupMetrics([
      metric("calls", "renderer"),
      metric("chunks", "voxel"),
      metric("textures", "renderer")
    ]);

    assert.deepEqual(
      groups.map(({ title }) => title),
      ["renderer", "voxel"]
    );
    assert.deepEqual(
      groups[0].metrics.map(({ id }) => id),
      ["calls", "textures"]
    );
  });

  it("orders groups by where each is first named", () => {
    const groups = groupMetrics([
      metric("chunks", "voxel"),
      metric("fps"),
      metric("calls", "renderer")
    ]);

    assert.deepEqual(
      groups.map(({ title }) => title),
      ["voxel", null, "renderer"]
    );
  });

  it("returns nothing for no definitions", () => {
    assert.deepEqual(groupMetrics([]), []);
  });
});
