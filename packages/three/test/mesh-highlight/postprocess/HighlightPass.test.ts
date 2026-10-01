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
import {
  createEntriesOfEveryShape,
  createMesh,
  createRendererStub
} from "./helpers.ts";

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

describe("edgeThickness and edgeGlow", () => {
  test("round-trip through the constructor options and the setters", () => {
    const cases = [
      ["edgeThickness", 3],
      ["edgeGlow", 0.5]
    ] as const;

    for (const [property, value] of cases) {
      assert.strictEqual(createPass({ [property]: value })[property], value, property);

      const highlight = createPass();
      highlight[property] = value;
      assert.strictEqual(highlight[property], value, property);
    }
  });
});

describe("entries", () => {
  test("returns a copy of the assigned entries", () => {
    const highlight = createPass();
    const entry = {
      target: createMesh(),
      color: "#ff0000"
    };
    highlight.entries = [entry];

    const entries = highlight.entries;
    entries.length = 0;

    assert.deepStrictEqual(highlight.entries, [entry]);
  });

  test("replaces the previous entries rather than accumulating them", () => {
    const highlight = createPass();
    const entry = {
      target: createMesh(),
      color: "#0000ff"
    };

    highlight.entries = createEntriesOfEveryShape();
    highlight.entries = [entry];

    assert.deepStrictEqual(highlight.entries, [entry]);
  });
});

describe("dispose", () => {
  test("clears the assigned entries", () => {
    const highlight = createPass();
    highlight.entries = createEntriesOfEveryShape();

    highlight.dispose();

    assert.deepStrictEqual(highlight.entries, []);
  });
});
