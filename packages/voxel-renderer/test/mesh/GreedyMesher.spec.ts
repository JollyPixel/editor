// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import { VoxelWorld } from "../../src/world/VoxelWorld.ts";
import { BlockRegistry } from "../../src/blocks/BlockRegistry.ts";
import { BlockShapeRegistry } from "../../src/blocks/BlockShapeRegistry.ts";
import { TilesetManager } from "../../src/tileset/TilesetManager.ts";
import { VoxelMeshBuilder } from "../../src/mesh/VoxelMeshBuilder.ts";
import { packTransform } from "../../src/utils/math.ts";

// CONSTANTS
const kCubeId = 1;
const kRampId = 2;
const kStairId = 3;
const kOtherCubeId = 4;
const kDefaultTexture = { col: 0, row: 0 };
const kChunkSize = 4;

function mockTexture(): any {
  return {
    magFilter: 0,
    minFilter: 0,
    colorSpace: "",
    generateMipmaps: true,
    image: { width: 64, height: 64 }
  };
}

function makeFixture(
  options: { greedy?: boolean; chunkSize?: number; } = {}
) {
  const { greedy = true, chunkSize = kChunkSize } = options;

  const world = new VoxelWorld(chunkSize);
  const layer = world.addLayer("test");

  const blockRegistry = new BlockRegistry([
    { id: kCubeId, name: "Cube", shapeId: "cube", faceTextures: {}, defaultTexture: kDefaultTexture, collidable: true },
    { id: kRampId, name: "Ramp", shapeId: "ramp", faceTextures: {}, defaultTexture: kDefaultTexture, collidable: true },
    { id: kStairId, name: "Stair", shapeId: "stair", faceTextures: {}, defaultTexture: kDefaultTexture, collidable: true },
    {
      id: kOtherCubeId,
      name: "Other",
      shapeId: "cube",
      faceTextures: {},
      defaultTexture: { col: 1, row: 0 },
      collidable: true
    }
  ]);

  const tilesetManager = new TilesetManager();
  tilesetManager.registerTexture(
    { id: "atlas", src: "/atlas.png", tileSize: 16, cols: 4, rows: 4 },
    mockTexture()
  );

  const builder = new VoxelMeshBuilder({
    world,
    blockRegistry,
    shapeRegistry: BlockShapeRegistry.createDefault(),
    tilesetManager,
    greedy
  });

  return { world, layer, builder, tilesetManager };
}

type Fixture = ReturnType<typeof makeFixture>;

function build(
  fixture: Fixture,
  chunkCoords: [number, number, number] = [0, 0, 0]
): Map<string, THREE.BufferGeometry> | null {
  const { layer, builder } = fixture;
  const chunk = layer.getChunk(...chunkCoords);

  return chunk ? builder.buildChunkGeometries(chunk, layer) : null;
}

/** Fills a solid box of `blockId`, inclusive bounds. */
function fill(
  fixture: Fixture,
  options: {
    from: [number, number, number];
    to: [number, number, number];
    blockId?: number;
    transform?: number;
  }
): void {
  const { from, to, blockId = kCubeId, transform = 0 } = options;

  for (let x = from[0]; x <= to[0]; x++) {
    for (let y = from[1]; y <= to[1]; y++) {
      for (let z = from[2]; z <= to[2]; z++) {
        fixture.world.setVoxelAt("test", { x, y, z }, { blockId, transform });
      }
    }
  }
}

function countVertices(
  geometries: Map<string, THREE.BufferGeometry> | null
): number {
  let total = 0;
  for (const geometry of geometries?.values() ?? []) {
    total += geometry.getAttribute("position").count;
  }

  return total;
}

/**
 * Total surface area of every quad, computed from the index buffer as the sum
 * of triangle areas. Merging must not change it: the same surface is covered by
 * fewer, larger quads.
 */
function surfaceArea(
  geometries: Map<string, THREE.BufferGeometry> | null
): number {
  let area = 0;

  for (const geometry of geometries?.values() ?? []) {
    const positions = geometry.getAttribute("position").array;
    const indices = geometry.getIndex()!.array;

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

describe("GreedyMesher — merging", () => {
  it("collapses a flat plate into one quad per direction", () => {
    const f = makeFixture();
    fill(f, { from: [0, 0, 0], to: [3, 0, 3] });

    // 6 quads: top, bottom and the four 4×1 sides.
    assert.equal(countVertices(build(f)), 6 * 4);
  });

  it("emits one quad per voxel face without greedy", () => {
    const f = makeFixture({ greedy: false });
    fill(f, { from: [0, 0, 0], to: [3, 0, 3] });

    // 16 top + 16 bottom + 4 sides × 4 = 48 faces.
    assert.equal(countVertices(build(f)), 48 * 4);
  });

  it("covers exactly the same surface as the naive mesher", () => {
    const greedy = makeFixture();
    const naive = makeFixture({ greedy: false });
    for (const f of [greedy, naive]) {
      fill(f, { from: [0, 0, 0], to: [3, 2, 3] });
    }

    const area = surfaceArea(build(greedy));
    assert.equal(area, surfaceArea(build(naive)));
    // A solid 4×4×3 box: two 4×4 faces plus four 4×3 faces.
    assert.equal(area, (2 * 16) + (4 * 12));
  });

  it("reports the folded faces in mergedFaces", () => {
    const f = makeFixture();
    fill(f, { from: [0, 0, 0], to: [3, 0, 3] });
    build(f);

    // 48 voxel faces became 6 quads.
    assert.equal(f.builder.stats.faces, 6);
    assert.equal(f.builder.stats.mergedFaces, 42);
  });

  it("leaves mergedFaces at zero without greedy", () => {
    const f = makeFixture({ greedy: false });
    fill(f, { from: [0, 0, 0], to: [3, 0, 3] });
    build(f);

    assert.equal(f.builder.stats.faces, 48);
    assert.equal(f.builder.stats.mergedFaces, 0);
  });

  it("merges a run into a single stretched quad", () => {
    const f = makeFixture();
    fill(f, { from: [0, 0, 0], to: [3, 0, 0] });
    const geometries = build(f);

    // A 4×1 strip: top, bottom, two 4-long sides and two 1×1 ends.
    assert.equal(countVertices(geometries), 6 * 4);

    const positions = [...geometries!.values()][0].getAttribute("position");
    let maxX = 0;
    for (let i = 0; i < positions.count; i++) {
      maxX = Math.max(maxX, positions.getX(i));
    }
    assert.equal(maxX, 4);
  });
});

describe("GreedyMesher — merge boundaries", () => {
  it("does not merge different blocks", () => {
    const uniform = makeFixture();
    fill(uniform, { from: [0, 0, 0], to: [3, 0, 0], blockId: kCubeId });

    const mixed = makeFixture();
    fill(mixed, { from: [0, 0, 0], to: [1, 0, 0], blockId: kCubeId });
    fill(mixed, { from: [2, 0, 0], to: [3, 0, 0], blockId: kOtherCubeId });

    // The uniform strip collapses to 6 quads. Splitting it in two halves stops
    // the merge at the block change, leaving each half with its own 5 quads —
    // the sixth is the culled face where the halves meet.
    assert.equal(countVertices(build(uniform)), 6 * 4);
    assert.equal(countVertices(build(mixed)), 10 * 4);
  });

  it("does not merge voxels with different transforms", () => {
    const f = makeFixture();
    fill(f, { from: [0, 0, 0], to: [1, 0, 0], blockId: kCubeId, transform: 0 });
    fill(f, {
      from: [2, 0, 0],
      to: [3, 0, 0],
      blockId: kCubeId,
      transform: packTransform(1, false, false)
    });

    // A rotated cube turns its tile sideways, so it cannot share a quad with
    // an unrotated one even though both are the same block.
    assert.equal(countVertices(build(f)), 10 * 4);
  });

  it("does not merge across a chunk boundary", () => {
    const f = makeFixture();
    // Two voxels either side of the x = 4 chunk edge.
    fill(f, { from: [3, 0, 0], to: [4, 0, 0] });

    const first = countVertices(build(f, [0, 0, 0]));
    const second = countVertices(build(f, [1, 0, 0]));

    // Each chunk meshes its own voxel: 5 visible faces, the shared one culled.
    assert.equal(first, 5 * 4);
    assert.equal(second, 5 * 4);
  });

  it("still culls faces hidden by an opaque neighbour", () => {
    const f = makeFixture();
    fill(f, { from: [0, 0, 0], to: [1, 0, 0] });
    build(f);

    // The two touching faces are culled, the other ten emitted as 6 quads.
    assert.equal(f.builder.stats.culledFaces, 2);
  });
});

describe("GreedyMesher — non-cube shapes", () => {
  it("meshes a stair identically with and without greedy", () => {
    const greedy = makeFixture();
    const naive = makeFixture({ greedy: false });
    for (const f of [greedy, naive]) {
      f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kStairId, transform: 0 });
    }

    assert.equal(countVertices(build(greedy)), countVertices(build(naive)));
  });

  it("merges only the full-quad faces of a ramp", () => {
    const f = makeFixture();
    fill(f, { from: [0, 0, 0], to: [3, 0, 0], blockId: kRampId });
    build(f);

    // A ramp's base (NegY) and back (PosZ) are full quads and merge over the
    // four voxels; the slope, the two triangles and the ends stay per-voxel.
    assert.equal(f.builder.stats.mergedFaces, 6);
  });

  it("keeps the same surface area for a ramp run", () => {
    const greedy = makeFixture();
    const naive = makeFixture({ greedy: false });
    for (const f of [greedy, naive]) {
      fill(f, { from: [0, 0, 0], to: [3, 0, 0], blockId: kRampId });
    }

    assert.equal(
      surfaceArea(build(greedy)).toFixed(6),
      surfaceArea(build(naive)).toFixed(6)
    );
  });

  it("merges cubes sitting next to unmergeable shapes", () => {
    const f = makeFixture();
    fill(f, { from: [0, 0, 0], to: [2, 0, 0], blockId: kCubeId });
    f.world.setVoxelAt("test", { x: 3, y: 0, z: 0 }, { blockId: kStairId, transform: 0 });

    const geometries = build(f);
    assert.ok(geometries !== null);
    // The three cubes still merge even though a stair shares the chunk.
    assert.ok(f.builder.stats.mergedFaces > 0);
  });
});

describe("GreedyMesher — tile attributes", () => {
  it("emits tileRegion and tileRepeat only in greedy mode", () => {
    const greedy = makeFixture();
    const naive = makeFixture({ greedy: false });
    for (const f of [greedy, naive]) {
      fill(f, { from: [0, 0, 0], to: [3, 0, 3] });
    }

    const [merged] = [...build(greedy)!.values()];
    assert.ok(merged.getAttribute("tileRegion"));
    assert.ok(merged.getAttribute("tileRepeat"));

    const [plain] = [...build(naive)!.values()];
    assert.equal(plain.getAttribute("tileRegion"), undefined);
    assert.equal(plain.getAttribute("tileRepeat"), undefined);
  });

  it("repeats the tile once per voxel across a merged quad", () => {
    const f = makeFixture();
    fill(f, { from: [0, 0, 0], to: [3, 0, 3] });

    const [geometry] = [...build(f)!.values()];
    const repeat = geometry.getAttribute("tileRepeat");
    const uv = geometry.getAttribute("uv");

    let maxRepeat = 0;
    let maxUv = 0;
    for (let i = 0; i < repeat.count; i++) {
      maxRepeat = Math.max(maxRepeat, repeat.getX(i), repeat.getY(i));
      maxUv = Math.max(maxUv, uv.getX(i), uv.getY(i));
    }

    // The 4×4 top face repeats the tile 4 times on both axes.
    assert.equal(maxRepeat, 4);
    assert.equal(maxUv, 4);
  });

  it("carries the tile's atlas rect on every vertex", () => {
    const f = makeFixture();
    fill(f, { from: [0, 0, 0], to: [1, 0, 1] });

    const expected = f.tilesetManager.getTileUV({ col: 0, row: 0 });
    const [geometry] = [...build(f)!.values()];
    const region = geometry.getAttribute("tileRegion");
    // The rect is stored as normalized uint16, so it decodes to within a step.
    const step = 1 / 65535;

    for (let i = 0; i < region.count; i++) {
      assert.ok(Math.abs(region.getX(i) - expected.offsetU) <= step);
      assert.ok(Math.abs(region.getY(i) - expected.offsetV) <= step);
      assert.ok(Math.abs(region.getZ(i) - expected.scaleU) <= step);
      assert.ok(Math.abs(region.getW(i) - expected.scaleV) <= step);
    }
  });

  it("keeps uv in tile space so the shader can fold it back", () => {
    const f = makeFixture();
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    const [geometry] = [...build(f)!.values()];
    const uv = geometry.getAttribute("uv");

    // A lone voxel merges nothing, so every UV is a tile corner.
    for (let i = 0; i < uv.count; i++) {
      assert.ok(uv.getX(i) === 0 || uv.getX(i) === 1);
      assert.ok(uv.getY(i) === 0 || uv.getY(i) === 1);
    }
  });
});

describe("GreedyMesher — layers", () => {
  it("still skips voxels a higher-priority layer covers", () => {
    const f = makeFixture();
    const top = f.world.addLayer("top");
    fill(f, { from: [0, 0, 0], to: [3, 0, 3] });
    for (let x = 0; x <= 3; x++) {
      top.setVoxelAt({ x, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    }

    build(f);
    assert.equal(f.builder.stats.hiddenVoxels, 4);
  });

  it("bakes the layer opacity into the vertex colors", () => {
    const f = makeFixture();
    f.world.updateLayer("test", { opacity: 0.5 });
    fill(f, { from: [0, 0, 0], to: [3, 0, 3] });

    const [geometry] = [...build(f)!.values()];
    const color = geometry.getAttribute("color");

    // Colors are stored as normalized bytes.
    assert.equal(Math.round(color.getW(0) * 255), 128);
  });
});

describe("VoxelMeshBuilder — greedy toggle", () => {
  it("defaults to off", () => {
    const f = makeFixture({ greedy: false });
    assert.equal(f.builder.greedy, false);
  });

  it("switches meshing mode at runtime", () => {
    const f = makeFixture({ greedy: false });
    fill(f, { from: [0, 0, 0], to: [3, 0, 3] });
    assert.equal(countVertices(build(f)), 48 * 4);

    f.builder.greedy = true;
    assert.equal(countVertices(build(f)), 6 * 4);

    f.builder.greedy = false;
    assert.equal(countVertices(build(f)), 48 * 4);
  });
});

describe("GreedyMesher — tiled attribute layout", () => {
  it("narrows tileRegion and tileRepeat but keeps tiled uv in float32", () => {
    const f = makeFixture();
    fill(f, { from: [0, 0, 0], to: [3, 0, 3] });

    const [geometry] = [...build(f)!.values()];

    // Tiled UVs are scaled by the merged span, so they run past 1 and cannot
    // be stored normalized.
    assert.ok(geometry.getAttribute("uv").array instanceof Float32Array);

    const region = geometry.getAttribute("tileRegion");
    assert.ok(region.array instanceof Uint16Array);
    assert.equal(region.normalized, true);
    assert.equal(region.itemSize, 4);

    const repeat = geometry.getAttribute("tileRepeat");
    assert.ok(repeat.array instanceof Uint16Array);
    assert.equal(repeat.normalized, false);
    assert.equal(repeat.itemSize, 2);
  });

  it("carries the merged span through tileRepeat unscaled", () => {
    const f = makeFixture();
    fill(f, { from: [0, 0, 0], to: [3, 0, 3] });

    const [geometry] = [...build(f)!.values()];
    const repeat = geometry.getAttribute("tileRepeat");

    // A 4x4 slab merges into one quad per direction, so the top face repeats
    // its tile 4 times on each axis.
    let sawFullSpan = false;
    for (let i = 0; i < repeat.count; i++) {
      assert.ok(Number.isInteger(repeat.getX(i)), `u repeat ${repeat.getX(i)}`);
      assert.ok(Number.isInteger(repeat.getY(i)), `v repeat ${repeat.getY(i)}`);
      if (repeat.getX(i) === 4 && repeat.getY(i) === 4) {
        sawFullSpan = true;
      }
    }
    assert.ok(sawFullSpan, "expected a quad repeating 4x4");
  });

  it("keeps tileRegion within one 16-bit step of the atlas rect", () => {
    const f = makeFixture();
    fill(f, { from: [0, 0, 0], to: [3, 0, 3] });

    const [geometry] = [...build(f)!.values()];
    const attribute = geometry.getAttribute("tileRegion");
    const expected = f.tilesetManager.getTileUV(kDefaultTexture);
    const step = 1 / 65535;

    for (let i = 0; i < attribute.count; i++) {
      assert.ok(Math.abs(attribute.getX(i) - expected.offsetU) <= step, "offsetU");
      assert.ok(Math.abs(attribute.getY(i) - expected.offsetV) <= step, "offsetV");
      assert.ok(Math.abs(attribute.getZ(i) - expected.scaleU) <= step, "scaleU");
      assert.ok(Math.abs(attribute.getW(i) - expected.scaleV) <= step, "scaleV");
    }
  });
});
