// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { makeUvMap } from "../../helpers/uv/map.ts";

describe("UVMap — overflow", () => {
  test("defaults to 0 and stores whole texture pixels only", () => {
    const map = makeUvMap();
    const values: number[] = [map.overflow];

    for (const value of [-3, Number.NaN, 2.7, Infinity]) {
      map.overflow = value;
      values.push(map.overflow);
    }

    assert.deepEqual(values, [0, 0, 0, 2, Infinity]);
  });

  test("unlimited overflow lets a resize reach past every texture edge", () => {
    const map = makeUvMap({ x: 16, y: 16 });
    map.overflow = Infinity;
    const region = map.create({ width: 4, height: 4 });

    map.resize(region.id, { x: -100, y: -50, width: 300, height: 200 });

    assert.deepEqual(
      map.get(region.id)!.bounds,
      { x: -100, y: -50, width: 300, height: 200 }
    );
  });

  test("stops a resized edge at the overflow limit instead of the texture edge", () => {
    const map = makeUvMap({ x: 32, y: 32 });
    map.overflow = 4;
    const region = map.create({ width: 4, height: 4 });
    map.move(region.id, { x: 26, y: 2, width: 4, height: 4 });

    map.resize(region.id, { x: 26, y: -10, width: 12, height: 16 });

    assert.deepEqual(
      map.get(region.id)!.bounds,
      { x: 26, y: -4, width: 10, height: 10 }
    );
  });

  test("an unfolded region moved past the limit stops with its whole net inside it", () => {
    const map = makeUvMap({ x: 32, y: 32 });
    map.overflow = 2;
    const region = map.create({ width: 4, height: 4 });
    map.setState(region.id, "unfolded");
    const { width, height } = map.get(region.id)!.bounds;

    map.move(region.id, { x: 100, y: -100, width, height });

    assert.deepEqual(
      map.get(region.id)!.bounds,
      { x: 34 - width, y: -2, width, height }
    );
  });
});
