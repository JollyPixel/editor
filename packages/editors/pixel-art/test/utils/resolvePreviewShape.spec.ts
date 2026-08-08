// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  UVRegion,
  type SelectionRect,
  type UVFace,
  type UVGeometry
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { resolvePreviewShapeKind } from "../../examples/scripts/preview/resolvePreviewShape.ts";

// CONSTANTS
const kRect: SelectionRect = {
  x: 0,
  y: 0,
  width: 16,
  height: 16
};

const kRampFaces: UVFace[] = [
  "back",
  "left",
  "right",
  "top",
  "bottom"
];

function facesWith(
  sideGeometry: UVGeometry
): Record<UVFace, UVGeometry> {
  return {
    front: kRect,
    back: kRect,
    left: sideGeometry,
    right: sideGeometry,
    top: kRect,
    bottom: kRect
  };
}

function regionWith(
  activeFaces: UVFace[],
  sideGeometry: UVGeometry
): UVRegion {
  return new UVRegion({
    id: "preview-shape",
    color: "#ffffff",
    rect: kRect,
    activeFaces,
    faces: facesWith(sideGeometry)
  });
}

describe("resolvePreviewShapeKind", () => {
  test("defaults ordinary regions to cube", () => {
    const region = new UVRegion({
      id: "cube",
      color: "#ffffff",
      rect: kRect
    });

    assert.strictEqual(resolvePreviewShapeKind(region), "cube");
  });

  test("recognizes ramp topology", () => {
    const region = regionWith(kRampFaces, {
      shape: "triangle",
      corner: "bottom-right",
      rect: kRect
    });

    assert.strictEqual(resolvePreviewShapeKind(region), "ramp");
  });

  test("does not infer a ramp from active faces alone", () => {
    const region = regionWith(kRampFaces, kRect);

    assert.strictEqual(resolvePreviewShapeKind(region), "cube");
  });
});
