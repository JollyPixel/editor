// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  HighlightPassJfa,
  type HighlightPassJfaOptions
} from "#src/index.ts";
import { createRendererStub } from "./helpers.ts";

function createPass(
  options?: HighlightPassJfaOptions
): HighlightPassJfa {
  return new HighlightPassJfa(
    createRendererStub(),
    new THREE.Scene(),
    new THREE.PerspectiveCamera(),
    options
  );
}

describe("constructor", () => {
  test("defaults ringThickness to 2", () => {
    const highlight = createPass();

    assert.strictEqual(highlight.ringThickness, 2);
  });

  test("defaults borderThickness to 1", () => {
    const highlight = createPass();

    assert.strictEqual(highlight.borderThickness, 1);
  });

  test("defaults isolatedFillOpacity to 0.15", () => {
    const highlight = createPass();

    assert.strictEqual(highlight.isolatedFillOpacity, 0.15);
  });

  test("exposes its own RenderPipeline", () => {
    const highlight = createPass();

    assert.ok(highlight.pipeline instanceof THREE.RenderPipeline);
  });
});

describe("ringThickness, borderThickness and isolatedFillOpacity", () => {
  test("round-trip through the constructor options and the setters", () => {
    const cases = [
      ["ringThickness", 5],
      ["borderThickness", 3],
      ["isolatedFillOpacity", 0.4]
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
    const highlight = createPass({ isolatedFillOpacity: 0.5 });

    highlight.configure({
      ringThickness: 4,
      borderThickness: 0
    });

    assert.deepStrictEqual(
      {
        ringThickness: highlight.ringThickness,
        borderThickness: highlight.borderThickness,
        isolatedFillOpacity: highlight.isolatedFillOpacity
      },
      {
        ringThickness: 4,
        borderThickness: 0,
        isolatedFillOpacity: 0.5
      }
    );
  });
});
