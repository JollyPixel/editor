// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/ecs";

// Import Internal Dependencies
import {
  EnvironmentDocument,
  PreviewEnvironment
} from "#src/index.ts";

// CONSTANTS
const kReflections = {
  reflections: true
};

function createPreview() {
  const records = [
    { id: "night", kind: "environment", path: "skies/Night.environment.json" },
    { id: "map", kind: "voxelmap", path: "maps/Level.voxelmap.json" },
    { id: "dawn", kind: "environment", path: "Dawn.environment.json" }
  ];
  const night = new EnvironmentDocument();
  night.change({ sky: { kind: "night" } });
  const preview = new PreviewEnvironment({
    catalog: {
      records: () => records,
      subscribe: () => () => undefined
    },
    open: (assetId) => (assetId === "night" ? { document: night, release: () => undefined } : null)
  });

  return { preview };
}

describe("PreviewEnvironment", () => {
  test("offers the lighting preset, then the project's environments by name", () => {
    const { preview } = createPreview();

    assert.deepEqual(preview.options(), [
      { value: "", label: "Lighting preset" },
      { value: "dawn", label: "Dawn" },
      { value: "night", label: "Night" }
    ]);
  });

  test("previews the chosen environment and the preset for one that does not open", () => {
    const { preview } = createPreview();
    const preset = Systems.ENVIRONMENT_PRESETS.studio;

    preview.choose("night");
    assert.equal(preview.value, "night");
    assert.equal(preview.linked, true);
    assert.deepEqual(preview.resolve(preset, kReflections).sky, { kind: "night" });

    preview.choose("dawn");
    assert.equal(preview.value, "");
    assert.equal(preview.linked, false);
    assert.equal(preview.resolve(preset, kReflections), preset);
  });

  test("turns reflections off without changing their intensity", () => {
    const { preview } = createPreview();
    const preset = Systems.ENVIRONMENT_PRESETS.studio;

    const file = preview.resolve(preset, { reflections: false });

    assert.deepEqual(file.reflections, {
      kind: "none",
      intensity: preset.reflections.intensity
    });
  });
});
