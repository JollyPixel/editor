// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { SettledSize } from "../../src/render/SettledSize.ts";

// CONSTANTS
const kSettleFrames = 6;

function requestFor(
  size: SettledSize,
  frames: number,
  width: number,
  height: number
): boolean[] {
  return Array.from(
    { length: frames },
    () => size.request(width, height)
  );
}

describe("SettledSize", () => {
  it("adopts the first requested size at once", () => {
    const size = new SettledSize();

    assert.equal(size.request(800, 600), true);
    assert.deepEqual([size.width, size.height], [800, 600]);
  });

  it("reports no change while the request matches", () => {
    const size = new SettledSize();
    size.request(800, 600);

    assert.deepEqual(
      requestFor(size, 3, 800, 600),
      [false, false, false]
    );
  });

  it("keeps the allocated size while the request keeps changing", () => {
    const size = new SettledSize();
    size.request(800, 600);

    for (let width = 801; width < 900; width++) {
      assert.equal(size.request(width, 600), false);
    }
    assert.deepEqual([size.width, size.height], [800, 600]);
  });

  it("adopts a request once it held still long enough", () => {
    const size = new SettledSize();
    size.request(800, 600);

    const changes = requestFor(size, kSettleFrames + 1, 640, 600);

    assert.deepEqual(
      changes,
      [...Array.from({ length: kSettleFrames }, () => false), true]
    );
    assert.deepEqual([size.width, size.height], [640, 600]);
  });

  it("restarts the wait when the request moves again", () => {
    const size = new SettledSize();
    size.request(800, 600);
    requestFor(size, kSettleFrames, 640, 600);

    assert.equal(size.request(641, 600), false);
    assert.deepEqual([size.width, size.height], [800, 600]);
  });

  it("adopts an immediate request at once", () => {
    const size = new SettledSize();
    size.request(800, 600);

    assert.equal(size.request(64, 64, true), true);
    assert.deepEqual([size.width, size.height], [64, 64]);
  });
});
