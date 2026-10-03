// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { mulberry32 } from "@jolly-pixel/bench";

// Import Internal Dependencies
import { IslandMap } from "#src/normal/IslandMap.ts";
import type {
  IslandFace,
  NormalMapInput,
  NormalMapSettings
} from "#src/normal/types.ts";
import { NormalMapConfig } from "#src/normal/NormalMapConfig.ts";
import { NormalMapGenerator } from "#src/normal/NormalMapGenerator.ts";

// CONSTANTS
const kFlat = [128, 128, 255, 255];
const kTransparent = -1;

function input(
  rows: number[][],
  settings: Partial<NormalMapSettings> = {},
  faces: IslandFace[] = []
): NormalMapInput {
  const size = { x: rows[0].length, y: rows.length };
  const pixels = new Uint8ClampedArray(size.x * size.y * 4);
  rows.flat().forEach((grey, index) => {
    pixels.set(
      grey === kTransparent ? [0, 0, 0, 0] : [grey, grey, grey, 255],
      index * 4
    );
  });

  return {
    size,
    pixels,
    islands: IslandMap.fromFaces(size, faces),
    config: NormalMapConfig.create(settings)
  };
}

function normalAt(
  output: Uint8ClampedArray,
  width: number,
  x: number,
  y: number
): number[] {
  const offset = ((y * width) + x) * 4;

  return [...output.subarray(offset, offset + 4)];
}

function rectFace(
  regionId: string,
  width: number,
  height: number
): IslandFace {
  return {
    regionId,
    geometry: { x: 0, y: 0, width, height }
  };
}

describe("NormalMapGenerator", () => {
  test("a uniform texture is flat", () => {
    const output = NormalMapGenerator.generate(input([
      [90, 90, 90],
      [90, 90, 90]
    ]));

    for (let index = 0; index < output.length; index += 4) {
      assert.deepEqual([...output.subarray(index, index + 4)], kFlat);
    }
  });

  test("a disabled config is flat", () => {
    const output = NormalMapGenerator.generate({
      ...input([[0, 255]]),
      config: null
    });

    assert.deepEqual(normalAt(output, 2, 0, 0), kFlat);
  });

  test("height rising to the right tilts the normal left", () => {
    const output = NormalMapGenerator.generate(input([[0, 128, 255]], {
      border: "clamp"
    }));

    assert.deepEqual(normalAt(output, 3, 1, 0), [13, 128, 185, 255]);
  });

  test("height rising downward tilts the normal up (green up)", () => {
    const output = NormalMapGenerator.generate(input([[0], [128], [255]], {
      border: "clamp"
    }));

    assert.deepEqual(normalAt(output, 1, 0, 1), [128, 242, 185, 255]);
  });

  test("invert flips the relief", () => {
    const output = NormalMapGenerator.generate(input([[0, 128, 255]], {
      border: "clamp",
      invert: true
    }));

    assert.deepEqual(normalAt(output, 3, 1, 0), [242, 128, 185, 255]);
  });

  test("levels snap the normal to a few directions", () => {
    const output = NormalMapGenerator.generate(input([[0, 128, 255]], {
      border: "clamp",
      levels: 3
    }));

    assert.deepEqual(normalAt(output, 3, 1, 0), [0, 128, 128, 255]);
  });

  test("transparent pixels encode flat", () => {
    const output = NormalMapGenerator.generate(input([[0, kTransparent, 255]]));

    assert.deepEqual(normalAt(output, 3, 1, 0), kFlat);
  });

  describe("edgeIntensity", () => {
    test("keeps the rim around cut-outs at 1", () => {
      const output = NormalMapGenerator.generate(input([[255, 255, kTransparent]], {
        border: "clamp"
      }));

      assert.ok(normalAt(output, 3, 1, 0)[0] > 128);
    });

    test("removes the rim around cut-outs at 0", () => {
      const output = NormalMapGenerator.generate(input([[255, 255, kTransparent]], {
        border: "clamp",
        edgeIntensity: 0
      }));

      assert.deepEqual(normalAt(output, 3, 1, 0), kFlat);
    });
  });

  describe("border", () => {
    test("wrap reads the opposite edge of a single rect island", () => {
      const output = NormalMapGenerator.generate(input(
        [[0, 255, 255]],
        { border: "wrap" },
        [rectFace("tile", 3, 1)]
      ));

      assert.ok(normalAt(output, 3, 2, 0)[0] > 128);
      assert.deepEqual(normalAt(output, 3, 0, 0), kFlat);
    });

    test("clamp reads the edge pixel itself", () => {
      const output = NormalMapGenerator.generate(input(
        [[0, 255, 255]],
        { border: "clamp" },
        [rectFace("tile", 3, 1)]
      ));

      assert.deepEqual(normalAt(output, 3, 2, 0), kFlat);
    });

    test("wrap falls back to clamp on an island that is not one rect", () => {
      const output = NormalMapGenerator.generate(input(
        [[0, 255, 255]],
        { border: "wrap" }
      ));

      assert.deepEqual(normalAt(output, 3, 2, 0), kFlat);
    });

    test("bevel rounds every edge of the island outward", () => {
      const rows = Array.from({ length: 5 }, () => [9, 9, 9, 9, 9]);
      const output = NormalMapGenerator.generate(input(
        rows,
        { border: "bevel", height: "flat" },
        [rectFace("tile", 5, 5)]
      ));

      assert.deepEqual(normalAt(output, 5, 2, 2), kFlat);
      assert.ok(normalAt(output, 5, 0, 2)[0] < 128);
      assert.ok(normalAt(output, 5, 4, 2)[0] > 128);
      assert.ok(normalAt(output, 5, 2, 0)[1] > 128);
      assert.ok(normalAt(output, 5, 2, 4)[1] < 128);
    });
  });

  test("regions gives every same-colour area its own pillow", () => {
    const rows = Array.from({ length: 3 }, () => [40, 40, 40, 200, 200, 200]);
    const output = NormalMapGenerator.generate(input(rows, {
      height: "regions",
      border: "clamp"
    }));

    assert.deepEqual(normalAt(output, 6, 1, 1), kFlat);
    assert.ok(normalAt(output, 6, 2, 1)[0] > 128);
    assert.ok(normalAt(output, 6, 3, 1)[0] < 128);
  });

  test("islands never sample across their edge", () => {
    const output = NormalMapGenerator.generate(input(
      [[255, 255, 0, 0]],
      { border: "clamp" },
      [
        { regionId: "a", geometry: { x: 0, y: 0, width: 2, height: 1 } },
        { regionId: "b", geometry: { x: 2, y: 0, width: 2, height: 1 } }
      ]
    ));

    assert.deepEqual(normalAt(output, 4, 1, 0), kFlat);
    assert.deepEqual(normalAt(output, 4, 2, 0), kFlat);
  });

  test("an off zone flattens its island and keeps the others", () => {
    const base = input(
      [[0, 255, 0, 255]],
      { border: "clamp" },
      [{ regionId: "glass", geometry: { x: 0, y: 0, width: 2, height: 1 } }]
    );
    assert.ok(base.config);
    const output = NormalMapGenerator.generate({
      ...base,
      config: base.config.withZone({ regionId: "glass", settings: "off" })
    });

    assert.deepEqual(normalAt(output, 4, 0, 0), kFlat);
    assert.notDeepEqual(normalAt(output, 4, 2, 0), kFlat);
  });

  test("rewriting the dirty area matches a full generation", () => {
    const random = mulberry32(7);
    const rows = Array.from(
      { length: 8 },
      () => Array.from({ length: 8 }, () => Math.floor(random() * 256))
    );
    const faces = [
      { regionId: "a", geometry: { x: 0, y: 0, width: 4, height: 4 } },
      { regionId: "b", geometry: { x: 4, y: 4, width: 4, height: 4 } }
    ];
    const before = input(rows, {}, faces);
    const output = NormalMapGenerator.generate(before);

    rows[0][3] = 255 - rows[0][3];
    rows[5][5] = 255 - rows[5][5];
    const after = input(rows, {}, faces);
    const generator = new NormalMapGenerator();
    for (const [x, y] of [[3, 0], [5, 5]]) {
      const area = { x: x - 1, y: y - 1, width: 3, height: 3 };
      for (const island of after.islands.islandsWithin(area)) {
        generator.writeIsland(after, output, island, area);
      }
    }

    assert.deepEqual(output, NormalMapGenerator.generate(after));
  });
});
