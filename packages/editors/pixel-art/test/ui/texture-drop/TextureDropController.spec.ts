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
  hasSupportedImageDrag,
  pointInTextureBounds,
  textureDropBounds
} from "../../../src/ui/texture-drop/TextureDropController.ts";

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

describe("TextureDropController geometry", () => {
  test("tracks camera, zoom, stage offset, and texture dimensions", () => {
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

    const bounds = textureDropBounds(canvas, stage);

    assert.deepStrictEqual(bounds, {
      left: 0,
      top: 32,
      width: 48,
      height: 24
    });
    assert.ok(pointInTextureBounds(20, 62, bounds, stage));
    assert.ok(!pointInTextureBounds(68, 62, bounds, stage));
    assert.ok(!pointInTextureBounds(20, 86, bounds, stage));
  });

  test("recognizes a supported file item while the drag file list is protected", () => {
    const item = {
      kind: "file",
      type: "image/png"
    } as DataTransferItem;
    const transfer = {
      files: { length: 0 },
      items: [item],
      types: ["Files"]
    } as unknown as DataTransfer;

    assert.ok(hasSupportedImageDrag(transfer));
  });

  test("rejects URL and unsupported file drags before showing an overlay", () => {
    const unsupported = {
      kind: "file",
      type: "image/svg+xml"
    } as DataTransferItem;

    assert.ok(!hasSupportedImageDrag({
      files: { length: 0 },
      items: [unsupported],
      types: ["Files"]
    } as unknown as DataTransfer));
    assert.ok(!hasSupportedImageDrag({
      files: { length: 0 },
      items: [],
      types: ["text/uri-list"]
    } as unknown as DataTransfer));
  });
});
