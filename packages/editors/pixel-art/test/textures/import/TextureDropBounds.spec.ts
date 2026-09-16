// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  TextureDropBounds
} from "../../../src/textures/import/TextureDropBounds.ts";

function rect(
  left: number,
  top: number,
  width: number,
  height: number
): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => {
      return {};
    }
  };
}

function measure(): TextureDropBounds {
  const stage = document.createElement("div");
  Object.assign(stage, {
    getBoundingClientRect: () => rect(20, 30, 400, 300)
  });
  const canvasElement = document.createElement("canvas");
  Object.assign(canvasElement, {
    getBoundingClientRect: () => rect(30, 50, 400, 300)
  });
  const canvas = {
    canvas: () => canvasElement,
    camera: { x: -10, y: 12 },
    zoom: { value: 3 },
    textureSize: { x: 16, y: 8 }
  } as unknown as PixelArtCanvas;

  return TextureDropBounds.measure(canvas, stage);
}

describe("TextureDropBounds", () => {
  test("tracks camera, zoom, stage offset, and texture dimensions", () => {
    const bounds = measure();

    assert.deepStrictEqual(
      {
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height
      },
      {
        left: 0,
        top: 32,
        width: 48,
        height: 24
      }
    );
    assert.ok(Object.isFrozen(bounds));
  });

  test("contains client points inside the texture, end edges excluded", () => {
    const bounds = measure();

    assert.ok(bounds.contains(20, 62));
    assert.ok(bounds.contains(67, 85));
    assert.ok(!bounds.contains(68, 62));
    assert.ok(!bounds.contains(20, 86));
    assert.ok(!bounds.contains(19, 62));
  });

  test("renders an absolute-position style", () => {
    assert.equal(
      measure().toStyle(),
      "left: 0px; top: 32px; width: 48px; height: 24px;"
    );
  });
});
