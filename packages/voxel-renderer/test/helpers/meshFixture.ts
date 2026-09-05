// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import {
  type VoxelChunk,
  type VoxelLayer,
  VoxelWorld
} from "../../src/world/index.ts";
import { BlockRegistry } from "../../src/blocks/index.ts";
import { BlockShapeRegistry } from "../../src/blocks/shape/index.ts";
import { TilesetManager } from "../../src/tileset/index.ts";
import { VoxelMeshBuilder } from "../../src/mesh/index.ts";
import { makeBlockDef } from "./blocks.ts";
import { makeAtlasDef } from "./atlas.ts";
import { mockTexture } from "./mockTexture.ts";

// CONSTANTS
export const CUBE_ID = 1;
export const RAMP_ID = 2;
export const STAIR_ID = 3;
export const LAYER = "test";
export const CHUNK_SIZE = 4;

export interface MeshFixture {
  world: VoxelWorld;
  layer: VoxelLayer;
  builder: VoxelMeshBuilder;
  blockRegistry: BlockRegistry;
  tilesetManager: TilesetManager;
}

export interface MeshFixtureOptions {
  greedy?: boolean;
  chunkSize?: number;
}

/**
 * A non-rendering mesh-building fixture: a world holding a single `LAYER`, a
 * registry with cube / ramp / stair, the default shape registry, and a
 * TilesetManager carrying the `makeAtlasDef()` atlas so UV lookup succeeds.
 * Specs needing more blocks register them on `blockRegistry`.
 */
export function makeMeshFixture(
  options: MeshFixtureOptions = {}
): MeshFixture {
  const { greedy = false, chunkSize = CHUNK_SIZE } = options;

  const world = new VoxelWorld(chunkSize);
  const layer = world.addLayer(LAYER);

  const blockRegistry = new BlockRegistry([
    makeBlockDef(CUBE_ID, "cube", { name: "Cube" }),
    makeBlockDef(RAMP_ID, "ramp", { name: "Ramp" }),
    makeBlockDef(STAIR_ID, "stair", { name: "Stair" })
  ]);

  const tilesetManager = new TilesetManager();
  tilesetManager.registerTexture(makeAtlasDef(), mockTexture());

  const builder = new VoxelMeshBuilder({
    world,
    blockRegistry,
    shapeRegistry: BlockShapeRegistry.createDefault(),
    tilesetManager,
    greedy
  });

  return { world, layer, builder, blockRegistry, tilesetManager };
}

/** Fills a solid box of `blockId`, inclusive bounds. */
export function fillBox(
  fixture: MeshFixture,
  options: {
    from: [number, number, number];
    to: [number, number, number];
    blockId?: number;
    transform?: number;
  }
): void {
  const { from, to, blockId = CUBE_ID, transform = 0 } = options;

  for (let x = from[0]; x <= to[0]; x++) {
    for (let y = from[1]; y <= to[1]; y++) {
      for (let z = from[2]; z <= to[2]; z++) {
        fixture.world.setVoxelAt(LAYER, { x, y, z }, { blockId, transform });
      }
    }
  }
}

/**
 * Builds the chunk at `chunkCoords`, or null when it holds nothing to mesh.
 */
export function buildChunk(
  fixture: MeshFixture,
  chunkCoords: [number, number, number] = [0, 0, 0]
): Map<string, THREE.BufferGeometry> | null {
  const { layer, builder } = fixture;
  const chunk = layer.getChunk(...chunkCoords);

  return chunk ? builder.buildChunkGeometries(chunk, layer) : null;
}

/**
 * Total vertices across every tileset geometry. Each quad contributes 4
 * vertices, each triangle 3.
 */
export function countVertices(
  geometries: Map<string, THREE.BufferGeometry> | null
): number {
  let total = 0;
  for (const geometry of geometries?.values() ?? []) {
    total += geometry.getAttribute("position").count;
  }

  return total;
}

/** Vertices emitted by `layer`'s chunk at the origin. */
export function countLayerVertices(
  fixture: MeshFixture,
  layer: VoxelLayer
): number {
  const chunk = layer.getChunk(0, 0, 0);

  return chunk
    ? countVertices(fixture.builder.buildChunkGeometries(chunk, layer))
    : 0;
}

/** Same as `countLayerVertices`, for the fixture's own layer. */
export function countChunkVertices(
  fixture: MeshFixture
): number {
  return countLayerVertices(fixture, fixture.layer);
}

/** Fetches the chunk at `chunkCoords`, asserting it exists. */
export function getChunk(
  fixture: MeshFixture,
  chunkCoords: [number, number, number] = [0, 0, 0]
): VoxelChunk {
  const chunk = fixture.layer.getChunk(...chunkCoords);
  assert.ok(chunk);

  return chunk;
}

/**
 * Builds the chunk at `chunkCoords`, asserting it produced geometries. Specs
 * exercising the null path (empty / hidden / unregistered) call the builder
 * directly instead of going through this helper.
 */
export function buildGeometries(
  fixture: MeshFixture,
  chunkCoords: [number, number, number] = [0, 0, 0]
): Map<string, THREE.BufferGeometry> {
  const geometries = buildChunk(fixture, chunkCoords);
  assert.ok(geometries);

  return geometries;
}

/** Same as `buildGeometries`, narrowed to the single geometry callers expect. */
export function firstGeometry(
  fixture: MeshFixture,
  chunkCoords: [number, number, number] = [0, 0, 0]
): THREE.BufferGeometry {
  const [geometry] = [...buildGeometries(fixture, chunkCoords).values()];

  return geometry;
}
