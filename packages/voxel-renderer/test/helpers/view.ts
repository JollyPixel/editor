// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { PulledChunkGeometry } from "../../src/view/meshing/index.ts";
import {
  VoxelDocument,
  type VoxelDocumentOptions
} from "../../src/document/VoxelDocument.ts";
import {
  VoxelView,
  type VoxelViewOptions
} from "../../src/view/VoxelView.ts";
import { makeBlockDef } from "./blocks.ts";
import { makeAtlasDef } from "./atlas.ts";
import { mockTexture } from "./mockTexture.ts";
import {
  CHUNK_SIZE,
  CUBE_ID
} from "./ids.ts";

// CONSTANTS
const kChunkCoords = /-?\d+,-?\d+,-?\d+/;

export type ViewTestOptions =
  & Omit<VoxelDocumentOptions, "blocksets">
  & VoxelViewOptions;

export function createView(
  options: ViewTestOptions = {}
): VoxelView {
  const {
    chunkSize,
    layers,
    blocks,
    materialGroups,
    blendGroups,
    onCommand,
    ...viewOptions
  } = options;
  const document = new VoxelDocument({
    chunkSize,
    layers,
    blocks,
    materialGroups,
    blendGroups,
    onCommand,
    logger: viewOptions.logger
  });

  return new VoxelView(document, viewOptions);
}

export function makeView(
  options: ViewTestOptions = {}
): VoxelView {
  const view = createView({
    chunkSize: CHUNK_SIZE,
    blocks: [
      makeBlockDef(CUBE_ID, "cube", { name: "Cube" })
    ],
    ...options,
    meshing: {
      budgetMs: 0,
      ...options.meshing
    }
  });
  view.loadBlockset(makeAtlasDef(), mockTexture());

  return view;
}

export function fillChunks(
  view: VoxelView,
  layerName: string,
  count: number,
  blockId = CUBE_ID
): void {
  for (let i = 0; i < count; i++) {
    view.document.world.setVoxel(layerName, {
      position: { x: i * CHUNK_SIZE, y: 0, z: 0 },
      blockId
    });
  }
}

export function placeCube(
  view: VoxelView,
  layerName: string,
  position: { x: number; y: number; z: number; },
  blockId = CUBE_ID
): void {
  view.document.world.setVoxel(layerName, { position, blockId });
}

export function chunkGroup(
  view: { root: THREE.Object3D; }
): THREE.Object3D {
  const group = view.root.getObjectByName("VoxelView:chunks");
  if (!group) {
    throw new Error("the chunk group must be attached to the view root");
  }

  return group;
}

export function chunkMeshes(
  view: { root: THREE.Object3D; }
): THREE.Mesh[] {
  return chunkGroup(view).children.filter(
    (child): child is THREE.Mesh => child instanceof THREE.Mesh
  );
}

export function faceCountOf(
  mesh: THREE.Mesh
): number {
  return (mesh.geometry as PulledChunkGeometry).faceCount;
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
