// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  DEFAULT_WALKABLE_SLOPE,
  MAX_WALKABLE_SLOPE
} from "@jolly-pixel/terrain.renderer";
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { OverlaySettings } from "#src/state/OverlaySettings.ts";

describe("OverlaySettings", () => {
  test("the overlay and walkable slope come back after a reload, clamped, unknown values replaced", () => {
    const storage = new MemoryStorageAdapter();
    new OverlaySettings(storage).update({ overlay: "slope", walkableSlope: 120 });

    assert.deepEqual(
      { ...new OverlaySettings(storage).options },
      { overlay: "slope", walkableSlope: MAX_WALKABLE_SLOPE }
    );
    assert.deepEqual(
      { ...OverlaySettings.parse(JSON.stringify({ overlay: "heat", walkableSlope: "steep" })) },
      { overlay: "none", walkableSlope: DEFAULT_WALKABLE_SLOPE }
    );
  });

  test("an update that changes nothing emits nothing", () => {
    const settings = new OverlaySettings();
    const overlays: string[] = [];
    settings.subscribe("change", ({ overlay }) => overlays.push(overlay));
    settings.update({ overlay: "none" });
    settings.update({ overlay: "lod" });

    assert.deepEqual(overlays, ["lod"]);
  });
});
