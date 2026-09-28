// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  FACE_TEMPLATE_TEXELS,
  FACE_TEMPLATES_PER_ROW,
  FaceTemplateTable
} from "../../../../src/view/meshing/index.ts";
import type { BlockVariantFace } from "../../../../src/view/meshing/variants/types.ts";

function makeFace(
  x: number,
  vertexCount = 4
): BlockVariantFace {
  const corners = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]].slice(0, vertexCount);

  return {
    cull: 5,
    slot: 0,
    vertexCount,
    indexCount: vertexCount === 4 ? 6 : 3,
    positions: new Float32Array(corners.flatMap(([px, py, pz]) => [px + x, py, pz])),
    uvs: new Uint16Array(corners.flatMap(([px, py]) => [px * 65535, py * 65535])),
    region: new Uint16Array([0, 0, 65535, 65535]),
    full: vertexCount === 4,
    splittable: false,
    normalX: 0,
    normalY: 0,
    normalZ: 127
  };
}

function templateTexels(
  table: FaceTemplateTable,
  id: number
): Float32Array {
  const data = table.texture.image.data as Float32Array;
  const offset = id * FACE_TEMPLATE_TEXELS * 4;

  return data.subarray(offset, offset + (FACE_TEMPLATE_TEXELS * 4));
}

describe("FaceTemplateTable", () => {
  it("gives identical faces one template, whatever object holds them", () => {
    const table = new FaceTemplateTable();

    const first = table.idOf(makeFace(0));
    const second = table.idOf(makeFace(0));
    const other = table.idOf(makeFace(0.5));

    assert.equal(first, second);
    assert.notEqual(first, other);
    assert.equal(table.count, 2);
  });

  it("writes corners, atlas coordinates, region and normal as floats", () => {
    const table = new FaceTemplateTable();
    const id = table.idOf(makeFace(2));
    const texels = templateTexels(table, id);

    assert.deepEqual(Array.from(texels.subarray(0, 4)), [2, 0, 0, 0]);
    assert.deepEqual(Array.from(texels.subarray(8, 12)), [3, 1, 0, 1]);
    assert.deepEqual(Array.from(texels.subarray(16, 20)), [0, 0, 1, 1]);
    assert.deepEqual(Array.from(texels.subarray(20, 24)), [0, 0, 1, 1]);
    assert.deepEqual(Array.from(texels.subarray(24, 27)), [0, 0, 1]);
    assert.equal(texels[27], 0 + (1 * 4));
  });

  it("repeats the last corner of a triangle", () => {
    const table = new FaceTemplateTable();
    const id = table.idOf(makeFace(0, 3));

    assert.deepEqual(
      table.copyVertexTo(id, 3, new THREE.Vector3()).toArray(),
      table.copyVertexTo(id, 2, new THREE.Vector3()).toArray()
    );
  });

  it("grows by whole rows and keeps earlier templates", () => {
    const table = new FaceTemplateTable();
    const initial = table.texture;
    const node = table.node;
    let disposed = false;
    initial.addEventListener("dispose", () => {
      disposed = true;
    });

    for (let i = 0; i <= FACE_TEMPLATES_PER_ROW; i++) {
      table.idOf(makeFace(i));
    }

    assert.equal(table.count, FACE_TEMPLATES_PER_ROW + 1);
    assert.notEqual(table.texture, initial);
    assert.equal(table.texture.image.height, 2);
    assert.equal(node.value, table.texture);
    assert.equal(disposed, true);
    assert.deepEqual(
      table.copyVertexTo(0, 1, new THREE.Vector3()).toArray(),
      [1, 0, 0]
    );
    assert.deepEqual(
      table.copyVertexTo(FACE_TEMPLATES_PER_ROW, 0, new THREE.Vector3()).toArray(),
      [FACE_TEMPLATES_PER_ROW, 0, 0]
    );
  });

  it("flags the texture for upload when a template is added", () => {
    const table = new FaceTemplateTable();
    const version = table.texture.version;

    table.idOf(makeFace(0));
    table.idOf(makeFace(0));

    assert.equal(table.texture.version, version + 1);
  });
});
