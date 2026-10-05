// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  FACE_REGIONS_PER_ROW,
  FaceRegionTable
} from "../../../../src/view/meshing/index.ts";

function unorm16(
  value: number
): number {
  return Math.fround(Math.round(value * 65535) / 65535);
}

function regionTexel(
  table: FaceRegionTable,
  id: number
): number[] {
  const data = table.texture.image.data as Float32Array;

  return Array.from(data.subarray(id * 4, (id * 4) + 4));
}

describe("FaceRegionTable", () => {
  it("gives each block texture slot one stable id", () => {
    const table = new FaceRegionTable();

    const top = table.idOf(1, "top");
    const side = table.idOf(1, "side");
    const otherBlock = table.idOf(2, "top");

    assert.equal(table.idOf(1, "top"), top);
    assert.deepEqual(new Set([top, side, otherBlock]).size, 3);
    assert.equal(table.count, 3);
  });

  it("writes unorm16-quantized rects and flags an upload only on change", () => {
    const table = new FaceRegionTable();
    const id = table.idOf(1, "top");
    const version = table.texture.version;
    const region = {
      offsetU: 0.25,
      offsetV: 0.5,
      scaleU: 1 / 3,
      scaleV: 0.125
    };

    table.write(id, region);
    table.write(id, region);

    assert.deepEqual(
      regionTexel(table, id),
      [0.25, 0.5, 1 / 3, 0.125].map(unorm16)
    );
    assert.equal(table.texture.version, version + 1);
  });

  it("reuses the ids it was seeded with and allocates after them", () => {
    const source = new FaceRegionTable();
    source.idOf(4, "top");
    source.idOf(9, "front");

    const seeded = new FaceRegionTable(source.assignments());

    assert.equal(seeded.idOf(9, "front"), source.idOf(9, "front"));
    assert.equal(seeded.idOf(4, "top"), source.idOf(4, "top"));
    assert.equal(seeded.idOf(5, "top"), 2);
  });

  it("grows by whole rows and keeps earlier rects", () => {
    const table = new FaceRegionTable();
    const initial = table.texture;
    const node = table.node;
    const first = table.idOf(0, "top");
    table.write(first, {
      offsetU: 0.5,
      offsetV: 0.5,
      scaleU: 0.5,
      scaleV: 0.5
    });

    for (let blockId = 1; blockId <= FACE_REGIONS_PER_ROW; blockId++) {
      table.idOf(blockId, "top");
    }

    assert.notEqual(table.texture, initial);
    assert.equal(table.texture.image.height, 2);
    assert.equal(node.value, table.texture);
    assert.deepEqual(
      regionTexel(table, first),
      [0.5, 0.5, 0.5, 0.5].map(unorm16)
    );
  });
});
