// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { IslandMap } from "#src/normal/IslandMap.ts";
import type { IslandFace } from "#src/normal/types.ts";
import { UVRegion } from "#src/uv/region/UVRegion.ts";
import type { Vec2 } from "#src/types.ts";

function islandRows(
  map: IslandMap
): string[] {
  const rows: string[] = [];
  for (let y = 0; y < map.size.y; y++) {
    rows.push(
      [...map.indices.subarray(y * map.size.x, (y + 1) * map.size.x)].join("")
    );
  }

  return rows;
}

function face(
  regionId: string,
  x: number,
  y: number,
  size: Vec2 = { x: 2, y: 2 }
): IslandFace {
  return {
    regionId,
    geometry: { x, y, width: size.x, height: size.y }
  };
}

describe("IslandMap", () => {
  test("a texture without faces is one remainder island", () => {
    const map = IslandMap.fromFaces({ x: 3, y: 2 }, []);

    assert.equal(map.islands.length, 1);
    assert.equal(map.remainder?.pixelCount, 6);
    assert.equal(map.remainder?.isRect, false);
    assert.deepEqual(map.remainder?.bounds, { x: 0, y: 0, width: 3, height: 2 });
  });

  test("faces that only touch stay separate islands", () => {
    const map = IslandMap.fromFaces({ x: 5, y: 2 }, [
      face("a", 0, 0),
      face("b", 2, 0)
    ]);

    assert.deepEqual(islandRows(map), [
      "00112",
      "00112"
    ]);
    assert.equal(map.islands[0].isRect, true);
    assert.equal(map.remainder?.index, 2);
  });

  test("faces whose pixels overlap merge into one island", () => {
    const map = IslandMap.fromFaces({ x: 4, y: 2 }, [
      face("a", 0, 0),
      face("b", 1, 0),
      face("c", 3, 0, { x: 1, y: 2 })
    ]);

    assert.deepEqual(islandRows(map), [
      "0001",
      "0001"
    ]);
    assert.deepEqual([...map.islands[0].regionIds], ["a", "b"]);
    assert.equal(map.islands[0].isRect, false);
    assert.equal(map.remainder, null);
  });

  test("a later face can join two earlier islands", () => {
    const map = IslandMap.fromFaces({ x: 5, y: 1 }, [
      face("a", 0, 0, { x: 2, y: 1 }),
      face("b", 3, 0, { x: 2, y: 1 }),
      face("c", 1, 0, { x: 3, y: 1 })
    ]);

    assert.deepEqual(islandRows(map), ["00000"]);
    assert.equal(map.islands.length, 1);
  });

  test("identical rect faces keep the island wrappable", () => {
    const map = IslandMap.fromFaces({ x: 2, y: 2 }, [
      face("side", 0, 0),
      face("top", 0, 0)
    ]);

    assert.equal(map.islands[0].isRect, true);
  });

  test("a triangle face covers the pixels whose center it contains", () => {
    const map = IslandMap.fromFaces({ x: 2, y: 2 }, [
      {
        regionId: "ramp",
        geometry: {
          shape: "triangle",
          rect: { x: 0, y: 0, width: 2, height: 2 },
          corner: "bottom-left"
        }
      }
    ]);

    assert.deepEqual(islandRows(map), [
      "01",
      "00"
    ]);
    assert.equal(map.islands[0].isRect, false);
  });

  test("fromRegions uses the active slots of every region", () => {
    const region = UVRegion.from({
      id: "cube",
      color: "#fff",
      state: "stacked",
      rect: { x: 1, y: 0, width: 1, height: 1 }
    });
    const map = IslandMap.fromRegions({ x: 2, y: 1 }, [region]);

    assert.deepEqual(islandRows(map), ["10"]);
    assert.deepEqual([...map.islands[0].regionIds], ["cube"]);
  });

  test("finds the islands of a region and within a rect", () => {
    const map = IslandMap.fromFaces({ x: 5, y: 2 }, [
      face("a", 0, 0),
      face("b", 2, 0)
    ]);

    assert.deepEqual(map.islandsOf("b").map((island) => island.index), [1]);
    assert.deepEqual(
      map.islandsWithin({ x: 1, y: 0, width: 2, height: 1 })
        .map((island) => island.index),
      [0, 1]
    );
    assert.equal(map.islandAt(4, 1)?.isRemainder, true);
    assert.equal(map.islandAt(5, 0), null);
  });
});
