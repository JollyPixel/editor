// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  UVNet,
  type PixelArtCanvas
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { CanvasDefaults } from "../../src/textures/CanvasDefaults.ts";

function makeCanvas() {
  return {
    backgroundColor: "#123456",
    tools: {
      uv: {
        resizable: false
      }
    },
    uv: {
      overflow: 0,
      net: UVNet.packed
    }
  };
}

describe("CanvasDefaults", () => {
  test("with() changes one setting and keeps the others", () => {
    const net = new UVNet([["top"], ["front"]]);
    const defaults = new CanvasDefaults({
      uvResizable: true,
      uvNet: net
    }).with({ uvOverflow: 4 });

    assert.equal(defaults.uvResizable, true);
    assert.equal(defaults.uvOverflow, 4);
    assert.equal(defaults.uvNet, net);
    assert.equal(defaults.backgroundColor, null);
  });

  test("applyTo writes the UV settings and the background", () => {
    const canvas = makeCanvas();

    new CanvasDefaults({
      uvResizable: true,
      uvOverflow: 2,
      backgroundColor: "#000000"
    }).applyTo(canvas as unknown as PixelArtCanvas);

    assert.equal(canvas.tools.uv.resizable, true);
    assert.equal(canvas.uv.overflow, 2);
    assert.equal(canvas.backgroundColor, "#000000");
  });

  test("applyTo keeps the canvas background until one is resolved", () => {
    const canvas = makeCanvas();

    new CanvasDefaults().applyTo(canvas as unknown as PixelArtCanvas);

    assert.equal(canvas.backgroundColor, "#123456");
  });
});
