// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Viewport } from "#src/rendering/Viewport.ts";

describe("Viewport eased zoom", () => {
  test("keeps the camera and zoom unchanged until update while easing", () => {
    const vp = makeEasedViewport();
    const camera = { ...vp.camera };
    vp.applyZoom(-300, 150, 170);

    assert.strictEqual(vp.zoom.value, 4);
    assert.deepStrictEqual(vp.camera, camera);
  });

  test("keeps the texture pixel under the zoom point fixed while easing", () => {
    const vp = makeEasedViewport();
    const pixel = texturePointAt(vp, 150, 170);
    vp.applyZoom(-300, 150, 170);

    while (vp.update(16)) {
      assertPointFixed(vp, 150, 170, pixel);
    }
    assertPointFixed(vp, 150, 170, pixel);
    assert.ok(vp.zoom.value > 4);
  });

  test("re-anchors on the zoom point of a retargeting wheel event", () => {
    const vp = makeEasedViewport();
    vp.applyZoom(-300, 150, 170);
    vp.update(16);

    const pixel = texturePointAt(vp, 250, 220);
    vp.applyZoom(-100, 250, 220);

    while (vp.update(16)) {
      assertPointFixed(vp, 250, 220, pixel);
    }
    assertPointFixed(vp, 250, 220, pixel);
  });

  test("moves the zoom point with a pan while easing", () => {
    const vp = makeEasedViewport();
    vp.applyZoom(-300, 150, 170);
    vp.update(16);
    vp.applyPan(10, -5);

    const pixel = texturePointAt(vp, 160, 165);
    while (vp.update(16)) {
      assertPointFixed(vp, 160, 165, pixel);
    }
  });

  test("keeps camera coordinates on whole pixels", () => {
    const vp = makeEasedViewport();
    vp.applyZoom(-300, 151, 173);

    while (vp.update(7)) {
      assert.ok(Number.isInteger(vp.camera.x));
      assert.ok(Number.isInteger(vp.camera.y));
    }
  });

  test("centerTexture settles a running zoom", () => {
    const vp = makeEasedViewport();
    vp.applyZoom(-300, 150, 170);
    vp.update(16);
    vp.centerTexture();

    assert.strictEqual(vp.zoom.isAnimating, false);
    assert.strictEqual(vp.zoom.value, vp.zoom.target);
    assert.strictEqual(vp.update(16), false);
  });

  test("resizeCanvas settles a running zoom", () => {
    const vp = makeEasedViewport();
    vp.applyZoom(-300, 150, 170);
    vp.resizeCanvas(300, 300);

    assert.strictEqual(vp.zoom.isAnimating, false);
  });
});

function makeEasedViewport(): Viewport {
  const vp = new Viewport({
    textureSize: {
      x: 64,
      y: 64
    },
    zoom: 4
  });
  vp.resizeCanvas(400, 400);

  return vp;
}

function texturePointAt(
  vp: Viewport,
  sx: number,
  sy: number
): { x: number; y: number; } {
  return {
    x: (sx - vp.camera.x) / vp.zoom.value,
    y: (sy - vp.camera.y) / vp.zoom.value
  };
}

function assertPointFixed(
  vp: Viewport,
  sx: number,
  sy: number,
  expected: { x: number; y: number; }
): void {
  const actual = texturePointAt(vp, sx, sy);
  const tolerance = (0.5 / vp.zoom.value) + 1e-9;

  assert.ok(
    Math.abs(actual.x - expected.x) <= tolerance &&
    Math.abs(actual.y - expected.y) <= tolerance,
    `texture point drifted from ${JSON.stringify(expected)} to ${JSON.stringify(actual)}`
  );
}
