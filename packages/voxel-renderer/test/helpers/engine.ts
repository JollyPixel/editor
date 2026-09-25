// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  VoxelEngine,
  type VoxelEngineOptions
} from "../../src/VoxelEngine.ts";
import { makeBlockDef } from "./blocks.ts";
import { makeAtlasDef } from "./atlas.ts";
import { mockTexture } from "./mockTexture.ts";
import {
  CHUNK_SIZE,
  CUBE_ID
} from "./ids.ts";

// CONSTANTS
const kChunkCoords = /-?\d+,-?\d+,-?\d+/;

export function makeEngine(
  options: VoxelEngineOptions = {}
): VoxelEngine {
  const engine = new VoxelEngine({
    chunkSize: CHUNK_SIZE,
    blocks: [
      makeBlockDef(CUBE_ID, "cube", { name: "Cube" })
    ],
    ...options
  });
  engine.loadTileset(makeAtlasDef(), mockTexture());

  return engine;
}

export function fillChunks(
  engine: VoxelEngine,
  layerName: string,
  count: number,
  blockId = CUBE_ID
): void {
  for (let i = 0; i < count; i++) {
    engine.world.setVoxel(layerName, {
      position: { x: i * CHUNK_SIZE, y: 0, z: 0 },
      blockId
    });
  }
}

export function placeCube(
  engine: VoxelEngine,
  layerName: string,
  position: { x: number; y: number; z: number; },
  blockId = CUBE_ID
): void {
  engine.world.setVoxel(layerName, { position, blockId });
}

export function chunkGroup(
  engine: { root: THREE.Object3D; }
): THREE.Object3D {
  const group = engine.root.getObjectByName("VoxelView:chunks");
  if (!group) {
    throw new Error("the chunk group must be attached to the engine root");
  }

  return group;
}

export function chunkMeshes(
  engine: { root: THREE.Object3D; }
): THREE.Mesh[] {
  return chunkGroup(engine).children.filter(
    (child): child is THREE.Mesh => child instanceof THREE.Mesh
  );
}

export function chunkCoordsOf(
  object: THREE.Object3D
): string {
  const [coords] = kChunkCoords.exec(object.name) ?? [""];

  return coords;
}

export function sortedChunkCoords(
  objects: Iterable<THREE.Object3D>
): string[] {
  return [...objects].map(chunkCoordsOf).sort();
}
