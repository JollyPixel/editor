// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { AtlasAverages } from "../../src/tileset/index.ts";
import { mockTexture } from "../helpers/mockTexture.ts";

type Rgba = [r: number, g: number, b: number, a: number];

// CONSTANTS
const kTolerance = 1e-6;
const kRed: Rgba = [255, 0, 0, 255];
const kBlue: Rgba = [0, 0, 255, 255];
const kClear: Rgba = [0, 255, 0, 0];

/**
 * Builds a linear-space texture from rows listed top to bottom, the way an
 * image reads.
 */
function textureFromRows(
  rows: Rgba[][],
  flipY = true
): THREE.DataTexture {
  const height = rows.length;
  const width = rows[0].length;
  const data = new Uint8Array(width * height * 4);
  rows.forEach((row, y) => {
    const imageRow = flipY ? y : height - 1 - y;
    row.forEach((texel, x) => {
      data.set(texel, ((imageRow * width) + x) * 4);
    });
  });

  const texture = new THREE.DataTexture(data, width, height);
  texture.flipY = flipY;

  return texture;
}

function assertAverage(
  actual: number[],
  expected: number[]
): void {
  actual.forEach((value, index) => {
    assert.ok(
      Math.abs(value - expected[index]) < kTolerance,
      `channel ${index}: ${value} !== ${expected[index]}`
    );
  });
}
describe("AtlasAverages", () => {
  it("returns null when the pixels cannot be read", () => {
    assert.equal(AtlasAverages.of(mockTexture(16, 16)), null);
  });

  it("shares one table per source texture", () => {
    const texture = textureFromRows([[kRed]]);

    const table = AtlasAverages.of(texture);
    assert.ok(table);
    assert.equal(AtlasAverages.of(texture), table);
    assert.equal(AtlasAverages.peek(texture), table);
  });

  it("allocates one extra row and column", () => {
    const table = AtlasAverages.of(textureFromRows([
      [kRed, kRed, kBlue],
      [kRed, kRed, kBlue]
    ]))!;

    assert.equal(table.texture.image.width, 4);
    assert.equal(table.texture.image.height, 3);
    assert.equal(table.texture.type, THREE.FloatType);
    assert.equal(table.texture.minFilter, THREE.NearestFilter);
  });

  it("averages any texel rect", () => {
    const table = AtlasAverages.of(textureFromRows([
      [kRed, kBlue],
      [kRed, kBlue]
    ]))!;

    assertAverage(table.average(0, 0, 1, 2), [1, 0, 0, 1]);
    assertAverage(table.average(1, 0, 2, 2), [0, 0, 1, 1]);
    assertAverage(table.average(0, 0, 2, 2), [0.5, 0, 0.5, 1]);
  });

  it("counts rows from the bottom whatever the upload orientation", () => {
    const rows: Rgba[][] = [
      [kRed],
      [kBlue]
    ];

    for (const flipY of [true, false]) {
      const table = AtlasAverages.of(textureFromRows(rows, flipY))!;

      assertAverage(table.average(0, 0, 1, 1), [0, 0, 1, 1]);
      assertAverage(table.average(0, 1, 1, 2), [1, 0, 0, 1]);
    }
  });

  it("weights colour by alpha and reports coverage", () => {
    const table = AtlasAverages.of(textureFromRows([
      [kRed, kClear]
    ]))!;

    assertAverage(table.average(0, 0, 2, 1), [1, 0, 0, 0.5]);
  });

  it("averages sRGB atlases in linear space", () => {
    const grey: Rgba = [128, 128, 128, 255];
    const texture = textureFromRows([[grey]]);
    texture.colorSpace = THREE.SRGBColorSpace;

    const [r] = AtlasAverages.of(texture)!.average(0, 0, 1, 1);
    const expected = ((128 / 255) + 0.055) / 1.055;
    assert.ok(Math.abs(r - (expected ** 2.4)) < kTolerance);
  });

  it("rebuilds only after the source texture changes", () => {
    const texture = textureFromRows([[kRed]]);
    const table = AtlasAverages.of(texture)!;

    assert.equal(table.refresh(), false);

    texture.image.data!.set(kBlue);
    texture.needsUpdate = true;

    assert.equal(table.refresh(), true);
    assertAverage(table.average(0, 0, 1, 1), [0, 0, 1, 1]);
  });

  it("reallocates the table when the source is resized", () => {
    const texture = textureFromRows([[kRed]]);
    const table = AtlasAverages.of(texture)!;
    let disposed = 0;
    table.texture.addEventListener("dispose", () => disposed++);

    texture.image = {
      data: new Uint8Array([...kBlue, ...kBlue]),
      width: 2,
      height: 1
    };
    texture.needsUpdate = true;
    table.refresh();

    assert.equal(disposed, 1);
    assert.equal(table.texture.image.width, 3);
    assertAverage(table.average(0, 0, 2, 1), [0, 0, 1, 1]);
  });

  it("is released with its source texture", () => {
    const texture = textureFromRows([[kRed]]);
    const table = AtlasAverages.of(texture)!;
    let disposed = false;
    table.texture.addEventListener("dispose", () => {
      disposed = true;
    });

    texture.dispose();

    assert.equal(disposed, true);
    assert.equal(AtlasAverages.peek(texture), undefined);
    assert.notEqual(AtlasAverages.of(texture), table);
  });
});
