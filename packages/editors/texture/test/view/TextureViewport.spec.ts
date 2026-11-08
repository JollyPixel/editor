// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { TextureViewport } from "#src/view/TextureViewport.ts";

// CONSTANTS
const kView = {
  width: 800,
  height: 600
};
const kSprite = {
  width: 16,
  height: 16
};

function placed(
  scale: number,
  x: number,
  y: number
): TextureViewport {
  return new TextureViewport({
    image: kSprite,
    fitted: false,
    scale,
    x,
    y
  });
}

describe("TextureViewport", () => {
  test("fit enlarges a small sprite by a whole factor, centered 64px inside the view", () => {
    const viewport = TextureViewport.fit(kView, kSprite);

    assert.equal(viewport.scale, 29);
    assert.equal(viewport.x, (800 - (16 * 29)) / 2);
    assert.equal(viewport.y, (600 - (16 * 29)) / 2);
  });

  test("fit shrinks an image larger than the view inside it", () => {
    const viewport = TextureViewport.fit(kView, {
      width: 3360,
      height: 1000
    });

    assert.equal(viewport.scale, 672 / 3360);
    assert.equal(viewport.percent, 20);
  });

  test("actual size shows one image pixel per view pixel, centered", () => {
    const viewport = TextureViewport.actualSize(kView, {
      width: 200,
      height: 100
    });

    assert.deepEqual(viewport.frame, {
      left: 300,
      top: 250,
      width: 200,
      height: 100
    });
  });

  test("adaptTo refits a fitted image to a resized view", () => {
    const viewport = TextureViewport.fit(kView, kSprite).adaptTo({
      width: 400,
      height: 400
    }, kSprite);

    assert.equal(viewport.scale, 17);
    assert.equal(viewport.x, (400 - (16 * 17)) / 2);
  });

  test("adaptTo keeps a zoomed or panned image where the user left it", () => {
    const zoomed = TextureViewport.fit(kView, kSprite).zoomAt({ x: 0, y: 0 }, 2);
    const panned = TextureViewport.actualSize(kView, kSprite).panBy(10, 0);

    assert.equal(zoomed.adaptTo({ width: 400, height: 400 }, kSprite), zoomed);
    assert.equal(panned.adaptTo({ width: 400, height: 400 }, kSprite), panned);
  });

  test("adaptTo fits again when the image changes size", () => {
    const viewport = placed(4, 10, 20).adaptTo(kView, {
      width: 32,
      height: 32
    });

    assert.equal(viewport.fitted, true);
    assert.equal(viewport.scale, 14);
  });

  test("zoomAt keeps the image pixel under the pointer in place", () => {
    const before = placed(2, 100, 50);
    const pointer = {
      x: 300,
      y: 250
    };
    const after = before.zoomAt(pointer, 3);

    assert.equal(after.scale, 6);
    assert.equal((pointer.x - after.x) / after.scale, (pointer.x - before.x) / before.scale);
    assert.equal((pointer.y - after.y) / after.scale, (pointer.y - before.y) / before.scale);
  });

  test("zoomAt stops at 64x and at 1/64", () => {
    const viewport = placed(1, 0, 0);

    assert.equal(viewport.zoomAt({ x: 0, y: 0 }, 1000).scale, 64);
    assert.equal(viewport.zoomAt({ x: 0, y: 0 }, 0.0001).scale, 1 / 64);
  });

  test("panBy moves the image without zooming", () => {
    const viewport = placed(4, 10, 20).panBy(-5, 7);

    assert.deepEqual(viewport.frame, {
      left: 5,
      top: 27,
      width: 64,
      height: 64
    });
  });
});
