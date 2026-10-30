// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { HEIGHT_RANGE } from "@jolly-pixel/terrain.renderer";
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  BRUSH_SIZE,
  SculptSettings
} from "#src/features/sculpt/model/SculptSettings.ts";

describe("SculptSettings", () => {
  test("stored settings come back after a reload, clamped, with unknown values replaced by defaults", () => {
    const storage = new MemoryStorageAdapter();
    new SculptSettings(storage).update({
      tool: "flatten",
      falloff: "sharp",
      size: 500,
      strength: 0.7,
      flattenTarget: "fixed",
      flattenHeight: -9000,
      holeMode: "fill",
      chunkMode: "remove"
    });
    const reloaded = new SculptSettings(storage).options;

    assert.deepEqual(
      { ...reloaded },
      {
        tool: "flatten",
        size: BRUSH_SIZE.max,
        strength: 0.7,
        paintStrength: 0.5,
        falloff: "sharp",
        spacing: 0.25,
        flattenTarget: "fixed",
        flattenHeight: HEIGHT_RANGE.min,
        holeMode: "fill",
        chunkMode: "remove"
      }
    );
    assert.deepEqual(
      {
        ...SculptSettings.parse(JSON.stringify({
          tool: "dig",
          strength: "high",
          spacing: -1,
          flattenTarget: "peak",
          holeMode: "dig",
          chunkMode: "grow"
        }))
      },
      {
        tool: "raise",
        size: 8,
        strength: 0.25,
        paintStrength: 0.5,
        falloff: "smooth",
        spacing: 0.05,
        flattenTarget: "press",
        flattenHeight: 0,
        holeMode: "cut",
        chunkMode: "add"
      }
    );
    assert.equal(SculptSettings.parse("{not json").tool, "raise");
  });

  test("an update that changes nothing emits nothing", () => {
    const settings = new SculptSettings();
    const changes: number[] = [];
    settings.subscribe("change", ({ size }) => changes.push(size));
    settings.update({ size: 8 });
    settings.update({ size: 12 });

    assert.deepEqual(changes, [12]);
  });
});
