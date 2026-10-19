// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  HighlightPass,
  type HighlightPassOptions
} from "#src/index.ts";
import { createRendererStub } from "./helpers.ts";

function createPass(
  options?: HighlightPassOptions
): HighlightPass {
  return new HighlightPass(
    createRendererStub(),
    new THREE.Scene(),
    new THREE.PerspectiveCamera(),
    options
  );
}

describe("constructor", () => {
  test("defaults edgeThickness to 1 and edgeGlow to 0", () => {
    const highlight = createPass();

    assert.strictEqual(highlight.edgeThickness, 1);
    assert.strictEqual(highlight.edgeGlow, 0);
  });

  test("exposes its own RenderPipeline", () => {
    const highlight = createPass();

    assert.ok(highlight.pipeline instanceof THREE.RenderPipeline);
  });
});

describe("tunables", () => {
  test("round-trip through the constructor options and the setters", () => {
    const cases = [
      ["edgeThickness", 3],
      ["edgeGlow", 0.5],
      ["downSampleRatio", 4]
    ] as const;

    for (const [property, value] of cases) {
      assert.strictEqual(createPass({ [property]: value })[property], value, property);

      const highlight = createPass();
      highlight[property] = value;
      assert.strictEqual(highlight[property], value, property);
    }
  });
});

describe("configure", () => {
  test("applies the given options and keeps the others", () => {
    const highlight = createPass({ downSampleRatio: 4 });

    highlight.configure({
      edgeThickness: 3,
      edgeGlow: 0.5
    });

    assert.deepStrictEqual(
      {
        edgeThickness: highlight.edgeThickness,
        edgeGlow: highlight.edgeGlow,
        downSampleRatio: highlight.downSampleRatio
      },
      {
        edgeThickness: 3,
        edgeGlow: 0.5,
        downSampleRatio: 4
      }
    );
  });
});
