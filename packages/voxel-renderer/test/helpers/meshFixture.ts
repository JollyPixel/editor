// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  type VoxelChunk,
  type VoxelLayer,
  VoxelWorld
} from "../../src/world/index.ts";
import { BlockRegistry } from "../../src/blocks/index.ts";
import { BlockShapeRegistry } from "../../src/blocks/shape/index.ts";
import { TilesetManager } from "../../src/tileset/index.ts";
import {
  VoxelMeshBuilder,
  type ChunkGeometryKey,
  type PulledChunkGeometry
} from "../../src/mesh/index.ts";
import { makeBlockDef } from "./blocks.ts";
import { registerAtlas } from "./atlas.ts";
import {
  CHUNK_SIZE,
  CUBE_ID,
  RAMP_ID,
  STAIR_ID
} from "./ids.ts";

// CONSTANTS
const kLayer = "test";

export type Vec3Tuple = [number, number, number];

export interface MeshFixture {
  world: VoxelWorld;
  layer: VoxelLayer;
  builder: VoxelMeshBuilder;
  blockRegistry: BlockRegistry;
  tilesetManager: TilesetManager;
}

export interface MeshFixtureOptions {
  chunkSize?: number;
  ambientOcclusion?: boolean;
}

export function makeMeshFixture(
  options: MeshFixtureOptions = {}
): MeshFixture {
  const {
    chunkSize = CHUNK_SIZE,
    ambientOcclusion = false
  } = options;

  const world = new VoxelWorld(chunkSize);
  const layer = world.addLayer(kLayer);

  const blockRegistry = new BlockRegistry([
    makeBlockDef(CUBE_ID, "cube", { name: "Cube" }),
    makeBlockDef(RAMP_ID, "ramp", { name: "Ramp" }),
    makeBlockDef(STAIR_ID, "stair", { name: "Stair" })
  ]);

  const tilesetManager = new TilesetManager();
  registerAtlas(tilesetManager);

  const builder = new VoxelMeshBuilder({
    world,
    blockRegistry,
    shapeRegistry: BlockShapeRegistry.createDefault(),
    tilesetManager,
    ambientOcclusion
  });

  return { world, layer, builder, blockRegistry, tilesetManager };
}

export function place(
  target: MeshFixture | VoxelLayer,
  [x, y, z]: Vec3Tuple,
  blockId = CUBE_ID,
  transform = 0
): void {
  const layer = "layer" in target ? target.layer : target;
  layer.setVoxelAt({ x, y, z }, { blockId, transform });
}

export function fillBox(
  fixture: MeshFixture,
  options: {
    from: Vec3Tuple;
    to: Vec3Tuple;
    blockId?: number;
    transform?: number;
  }
): void {
  const { from, to, blockId = CUBE_ID, transform = 0 } = options;

  for (let x = from[0]; x <= to[0]; x++) {
    for (let y = from[1]; y <= to[1]; y++) {
      for (let z = from[2]; z <= to[2]; z++) {
        place(fixture, [x, y, z], blockId, transform);
      }
    }
  }
}

export function buildChunk(
  fixture: MeshFixture,
  chunkCoords: Vec3Tuple = [0, 0, 0]
): Map<ChunkGeometryKey, PulledChunkGeometry> {
  const { layer, builder } = fixture;
  const chunk = layer.getChunk(...chunkCoords);

  return chunk ? builder.buildChunkGeometries([{ layer, chunk }]) : new Map();
}

export function countVertices(
  geometries: ReadonlyMap<ChunkGeometryKey, PulledChunkGeometry>
): number {
  let total = 0;
  for (const geometry of geometries.values()) {
    total += geometry.faceCount * 4;
  }

  return total;
}

export function countLayerVertices(
  fixture: MeshFixture,
  layer: VoxelLayer
): number {
  const chunk = layer.getChunk(0, 0, 0);

  return chunk
    ? countVertices(fixture.builder.buildChunkGeometries([{ layer, chunk }]))
    : 0;
}

export function countChunkVertices(
  fixture: MeshFixture
): number {
  return countLayerVertices(fixture, fixture.layer);
}

export function getChunk(
  fixture: MeshFixture,
  chunkCoords: Vec3Tuple = [0, 0, 0]
): VoxelChunk {
  const chunk = fixture.layer.getChunk(...chunkCoords);
  assert.ok(chunk);

  return chunk;
}

export function buildGeometries(
  fixture: MeshFixture,
  chunkCoords: Vec3Tuple = [0, 0, 0]
): Map<ChunkGeometryKey, PulledChunkGeometry> {
  const geometries = buildChunk(fixture, chunkCoords);
  assert.ok(geometries.size > 0);

  return geometries;
}

export function geometryAlphaModes(
  fixture: MeshFixture
): string[] {
  return Array.from(
    buildGeometries(fixture).keys(),
    (key) => key.surface.alphaMode
  );
}

export function firstGeometry(
  fixture: MeshFixture,
  chunkCoords: Vec3Tuple = [0, 0, 0]
): PulledChunkGeometry {
  const [geometry] = buildGeometries(fixture, chunkCoords).values();

  return geometry;
}
