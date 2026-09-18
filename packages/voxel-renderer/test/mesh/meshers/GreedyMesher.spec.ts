// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import { VoxelTransform } from "../../../src/world/index.ts";
import { DEFAULT_TEXTURE, makeBlockDef } from "../../helpers/blocks.ts";
import {
  buildChunk as build,
  countVertices,
  fillBox as fill,
  firstGeometry,
  makeMeshFixture,
  place,
  type MeshFixture,
  type MeshFixtureOptions
} from "../../helpers/meshFixture.ts";
import {
  CUBE_ID as kCubeId,
  RAMP_ID as kRampId,
  STAIR_ID as kStairId
} from "../../helpers/ids.ts";

// CONSTANTS
const kOtherCubeId = 4;
const kTwinCubeId = 5;
const kUint16Step = 1 / 65535;

function makeFixture(
  options: MeshFixtureOptions = {}
): MeshFixture {
  const fixture = makeMeshFixture({ greedy: true, ...options });
  fixture.blockRegistry.register(
    makeBlockDef(kOtherCubeId, "cube", {
      defaultTexture: { col: 1, row: 0 }
    })
  );

  return fixture;
}

function surfaceArea(
  geometries: Map<string, THREE.BufferGeometry> | null
): number {
  let area = 0;

  for (const geometry of geometries?.values() ?? []) {
    const positions = geometry.getAttribute("position").array;
    const { start, count } = geometry.drawRange;
    const indices = geometry.getIndex()!.array.subarray(start, start + count);

    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i] * 3;
      const b = indices[i + 1] * 3;
      const c = indices[i + 2] * 3;

      const abx = positions[b] - positions[a];
      const aby = positions[b + 1] - positions[a + 1];
      const abz = positions[b + 2] - positions[a + 2];
      const acx = positions[c] - positions[a];
      const acy = positions[c + 1] - positions[a + 1];
      const acz = positions[c + 2] - positions[a + 2];

      const cx = (aby * acz) - (abz * acy);
      const cy = (abz * acx) - (abx * acz);
      const cz = (abx * acy) - (aby * acx);

      area += Math.sqrt((cx * cx) + (cy * cy) + (cz * cz)) / 2;
    }
  }

  return area;
}

function plate(
  options: MeshFixtureOptions = {}
): MeshFixture {
  const fixture = makeFixture(options);
  fill(fixture, { from: [0, 0, 0], to: [3, 0, 3] });

  return fixture;
}

describe("GreedyMesher - merging", () => {
  for (const [greedy, faces, mergedFaces] of [[true, 6, 42], [false, 48, 0]] as const) {
    it(`meshes a 4x4 plate into ${faces} quads (greedy=${greedy})`, () => {
      const fixture = plate({ greedy });

      assert.equal(countVertices(build(fixture)), faces * 4);
      assert.equal(fixture.builder.stats.faces, faces);
      assert.equal(fixture.builder.stats.mergedFaces, mergedFaces);
    });
  }

  it("covers exactly the same surface as the naive mesher", () => {
    const greedy = makeFixture();
    const naive = makeFixture({ greedy: false });
    for (const fixture of [greedy, naive]) {
      fill(fixture, { from: [0, 0, 0], to: [3, 2, 3] });
    }

    const area = surfaceArea(build(greedy));
    assert.equal(area, surfaceArea(build(naive)));
    assert.equal(area, (2 * 16) + (4 * 12));
  });

  it("merges a run into a single stretched quad", () => {
    const fixture = makeFixture();
    fill(fixture, { from: [0, 0, 0], to: [3, 0, 0] });

    assert.equal(countVertices(build(fixture)), 6 * 4);

    const geometry = firstGeometry(fixture);
    geometry.computeBoundingBox();
    assert.equal(geometry.boundingBox!.max.x, 4);
  });
});

describe("GreedyMesher - merge boundaries", () => {
  it("does not merge different blocks", () => {
    const fixture = makeFixture();
    fill(fixture, { from: [0, 0, 0], to: [1, 0, 0], blockId: kCubeId });
    fill(fixture, { from: [2, 0, 0], to: [3, 0, 0], blockId: kOtherCubeId });

    assert.equal(countVertices(build(fixture)), 10 * 4);
  });

  it("merges only the faces a transform leaves looking the same", () => {
    const fixture = makeFixture();
    fill(fixture, { from: [0, 0, 0], to: [1, 0, 0] });
    fill(fixture, {
      from: [2, 0, 0],
      to: [3, 0, 0],
      transform: new VoxelTransform({ rotation: 1 }).packed
    });

    assert.equal(countVertices(build(fixture)), 8 * 4);
  });

  it("merges faces of different blocks drawn with the same tile", () => {
    const fixture = makeFixture();
    fixture.blockRegistry.register(makeBlockDef(kTwinCubeId, "cube"));
    fill(fixture, { from: [0, 0, 0], to: [1, 0, 0] });
    fill(fixture, { from: [2, 0, 0], to: [3, 0, 0], blockId: kTwinCubeId });

    assert.equal(countVertices(build(fixture)), 6 * 4);
  });

  it("merges double-sided faces that open onto air", () => {
    const fixture = makeFixture();
    fixture.blockRegistry.register(makeBlockDef(kTwinCubeId, "cube", {
      alphaMode: "blend",
      cullCoveredFaces: false
    }));
    fill(fixture, { from: [0, 0, 0], to: [3, 0, 3], blockId: kTwinCubeId });

    const geometries = build(fixture);
    assert.equal(countVertices(geometries), (6 + 48) * 4);
    assert.equal(surfaceArea(geometries), (2 * 16) + (4 * 4) + 48);
  });

  it("does not merge across a chunk boundary", () => {
    const fixture = makeFixture();
    fill(fixture, { from: [3, 0, 0], to: [4, 0, 0] });

    assert.equal(countVertices(build(fixture, [0, 0, 0])), 5 * 4);
    assert.equal(countVertices(build(fixture, [1, 0, 0])), 5 * 4);
  });

  it("still culls faces hidden by an opaque neighbour", () => {
    const fixture = makeFixture();
    fill(fixture, { from: [0, 0, 0], to: [1, 0, 0] });
    build(fixture);

    assert.equal(fixture.builder.stats.culledFaces, 2);
  });
});

describe("GreedyMesher - non-cube shapes", () => {
  it("meshes a stair identically with and without greedy", () => {
    const greedy = makeFixture();
    const naive = makeFixture({ greedy: false });
    for (const fixture of [greedy, naive]) {
      place(fixture, [0, 0, 0], kStairId);
    }

    assert.equal(countVertices(build(greedy)), countVertices(build(naive)));
  });

  it("merges only the full-quad faces of a ramp", () => {
    const fixture = makeFixture();
    fill(fixture, { from: [0, 0, 0], to: [3, 0, 0], blockId: kRampId });
    build(fixture);

    assert.equal(fixture.builder.stats.mergedFaces, 6);
  });

  it("keeps the same surface area for a ramp run", () => {
    const greedy = makeFixture();
    const naive = makeFixture({ greedy: false });
    for (const fixture of [greedy, naive]) {
      fill(fixture, { from: [0, 0, 0], to: [3, 0, 0], blockId: kRampId });
    }

    assert.equal(
      surfaceArea(build(greedy)).toFixed(6),
      surfaceArea(build(naive)).toFixed(6)
    );
  });

  it("merges cubes sitting next to unmergeable shapes", () => {
    const fixture = makeFixture();
    fill(fixture, { from: [0, 0, 0], to: [2, 0, 0] });
    place(fixture, [3, 0, 0], kStairId);

    assert.ok(build(fixture) !== null);
    assert.ok(fixture.builder.stats.mergedFaces > 0);
  });
});

describe("GreedyMesher - tile attributes", () => {
  it("emits tileRegion in both modes and tileRepeat only in greedy mode", () => {
    const merged = firstGeometry(plate());
    assert.ok(merged.getAttribute("tileRegion"));
    assert.ok(merged.getAttribute("tileRepeat"));

    const naive = firstGeometry(plate({ greedy: false }));
    assert.ok(naive.getAttribute("tileRegion"));
    assert.equal(naive.getAttribute("tileRepeat"), undefined);
  });

  it("narrows tileRegion and tileRepeat but keeps tiled uv in float32", () => {
    const geometry = firstGeometry(plate());

    assert.ok(geometry.getAttribute("uv").array instanceof Float32Array);

    const region = geometry.getAttribute("tileRegion");
    assert.ok(region.array instanceof Uint16Array);
    assert.equal(region.normalized, true);
    assert.equal(region.itemSize, 4);

    const repeat = geometry.getAttribute("tileRepeat");
    assert.ok(repeat.array instanceof Uint16Array);
    assert.equal(repeat.normalized, true);
    assert.equal(repeat.itemSize, 2);
  });

  it("repeats the tile once per voxel across a merged quad", () => {
    const geometry = firstGeometry(plate());
    const repeat = geometry.getAttribute("tileRepeat");
    const uv = geometry.getAttribute("uv");

    let maxRepeat = 0;
    let maxUv = 0;
    for (let i = 0; i < repeat.count; i++) {
      maxRepeat = Math.max(maxRepeat, repeat.array[i * 2], repeat.array[(i * 2) + 1]);
      maxUv = Math.max(maxUv, uv.getX(i), uv.getY(i));
    }

    assert.equal(maxRepeat, 4);
    assert.equal(maxUv, 4);
  });

  it("keeps tileRegion within one 16-bit step of the atlas rect", () => {
    const fixture = plate();
    const attribute = firstGeometry(fixture).getAttribute("tileRegion");
    const expected = fixture.tilesetManager.atlas().uvFor(DEFAULT_TEXTURE.col, DEFAULT_TEXTURE.row);

    for (let i = 0; i < attribute.count; i++) {
      assert.ok(Math.abs(attribute.getX(i) - expected.offsetU) <= kUint16Step, "offsetU");
      assert.ok(Math.abs(attribute.getY(i) - expected.offsetV) <= kUint16Step, "offsetV");
      assert.ok(Math.abs(attribute.getZ(i) - expected.scaleU) <= kUint16Step, "scaleU");
      assert.ok(Math.abs(attribute.getW(i) - expected.scaleV) <= kUint16Step, "scaleV");
    }
  });

  it("keeps uv in tile space so the shader can fold it back", () => {
    const fixture = makeFixture();
    place(fixture, [0, 0, 0]);
    const uv = firstGeometry(fixture).getAttribute("uv");

    for (let i = 0; i < uv.count; i++) {
      assert.ok(uv.getX(i) === 0 || uv.getX(i) === 1);
      assert.ok(uv.getY(i) === 0 || uv.getY(i) === 1);
    }
  });
});

describe("GreedyMesher - layers", () => {
  it("still skips voxels a higher-priority layer covers", () => {
    const fixture = plate();
    const top = fixture.world.addLayer("top");
    for (let x = 0; x <= 3; x++) {
      place(top, [x, 0, 0]);
    }

    build(fixture);

    assert.equal(fixture.builder.stats.hiddenVoxels, 4);
  });
});

describe("GreedyMesher - wide chunks", () => {
  it("merges runs that cross a 32-cell bit-row word", () => {
    const fixture = makeFixture({ chunkSize: 64 });
    fill(fixture, { from: [0, 0, 0], to: [39, 0, 39] });

    assert.equal(countVertices(build(fixture)), 6 * 4);
    assert.equal(surfaceArea(build(fixture)), (2 * 40 * 40) + (4 * 40));
  });

  it("culls faces hidden inside a volume spanning the last row bit", () => {
    const fixture = makeFixture({ chunkSize: 32 });
    fill(fixture, { from: [0, 0, 0], to: [31, 1, 31] });

    assert.equal(countVertices(build(fixture)), 6 * 4);
  });
});
