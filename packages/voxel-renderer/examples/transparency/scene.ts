// Import Third-party Dependencies
import type { VoxelWorld } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { TransparencyBlock } from "./atlas.ts";
import {
  clearBox,
  fillBox,
  type VoxelBox
} from "../shared/voxelBox.ts";

// CONSTANTS
export const WORLD_SIZE = 24;

export interface SceneLabel {
  text: string;
  x: number;
  y: number;
  z: number;
}

export const TransparencyLayer = {
  Ground: "Ground",
  Water: "Water",
  Glass: "Glass",
  Foliage: "Foliage"
} as const;

export type TransparencyLayerName =
  typeof TransparencyLayer[keyof typeof TransparencyLayer];

export const TRANSPARENCY_LAYERS: readonly TransparencyLayerName[] =
  Object.values(TransparencyLayer);

export const SCENE_LABELS: readonly SceneLabel[] = [
  { text: "water · blend", x: 5.5, y: 5.2, z: 18.5 },
  { text: "glass · blend", x: 15, y: 7.2, z: 18 },
  { text: "texture alpha ignored (opaque)", x: 6, y: 9.6, z: 5 },
  { text: "texture alpha tested (mask)", x: 15, y: 9.6, z: 5 },
  { text: "shapes · sun angle", x: 4, y: 4, z: 11 },
  { text: "cutout in a solid wall", x: 20.5, y: 5.6, z: 21 }
];

function walls(
  world: VoxelWorld,
  layerName: string,
  blockId: number,
  box: VoxelBox
): void {
  fillBox(world, layerName, blockId, { ...box, z1: box.z0 });
  fillBox(world, layerName, blockId, { ...box, z0: box.z1 });
  fillBox(world, layerName, blockId, { ...box, x1: box.x0 });
  fillBox(world, layerName, blockId, { ...box, x0: box.x1 });
}

function buildGround(
  world: VoxelWorld
): void {
  const { Ground } = TransparencyLayer;
  const last = WORLD_SIZE - 1;

  fillBox(world, Ground, TransparencyBlock.Stone, {
    x0: 0, x1: last, y0: 0, y1: 0, z0: 0, z1: last
  });
  fillBox(world, Ground, TransparencyBlock.Grass, {
    x0: 0, x1: last, y0: 1, y1: 1, z0: 0, z1: last
  });

  const pool = { x0: 2, x1: 9, y0: 1, y1: 1, z0: 15, z1: 22 };
  fillBox(world, Ground, TransparencyBlock.Plank, pool);
  fillBox(world, Ground, TransparencyBlock.Sand, {
    ...pool, x0: 3, x1: 8, z0: 16, z1: 21
  });
  walls(world, Ground, TransparencyBlock.Plank, { ...pool, y0: 2, y1: 3 });

  buildShapeCluster(world);
  buildWindowWall(world);
}

function buildShapeCluster(
  world: VoxelWorld
): void {
  const { Ground } = TransparencyLayer;
  const z = 10;

  for (const rotation of [0, 1, 2, 3] as const) {
    world.setVoxel(Ground, {
      position: { x: 2 + rotation, y: 2, z },
      blockId: TransparencyBlock.StoneRamp,
      rotation
    });
    world.setVoxel(Ground, {
      position: { x: 2 + rotation, y: 2, z: z + 2 },
      blockId: TransparencyBlock.StoneStair,
      rotation
    });
  }

  world.setVoxel(Ground, {
    position: { x: 6, y: 2, z },
    blockId: TransparencyBlock.PlankSlab
  });
  world.setVoxel(Ground, {
    position: { x: 6, y: 2, z: z + 2 },
    blockId: TransparencyBlock.StonePole
  });
}

function buildWindowWall(
  world: VoxelWorld
): void {
  const { Ground } = TransparencyLayer;

  fillBox(world, Ground, TransparencyBlock.Plank, {
    x0: 19, x1: 22, y0: 2, y1: 4, z0: 21, z1: 21
  });
  fillBox(world, Ground, TransparencyBlock.Window, {
    x0: 20, x1: 21, y0: 3, y1: 3, z0: 21, z1: 21
  });
  fillBox(world, Ground, TransparencyBlock.Ruby, {
    x0: 20, x1: 21, y0: 2, y1: 4, z0: 18, z1: 18
  });
}

function buildWater(
  world: VoxelWorld
): void {
  fillBox(world, TransparencyLayer.Water, TransparencyBlock.Water, {
    x0: 3, x1: 8, y0: 2, y1: 3, z0: 16, z1: 21
  });
}

function buildGreenhouse(
  world: VoxelWorld
): void {
  const { Glass, Ground } = TransparencyLayer;
  const box = { x0: 13, x1: 17, y0: 2, y1: 4, z0: 16, z1: 20 };

  walls(world, Glass, TransparencyBlock.Glass, box);
  fillBox(world, Glass, TransparencyBlock.Glass, { ...box, y0: 5, y1: 5 });
  clearBox(world, Glass, { x0: 15, x1: 15, y0: 2, y1: 3, z0: 20, z1: 20 });

  fillBox(world, Ground, TransparencyBlock.Plank, {
    x0: 14, x1: 16, y0: 2, y1: 2, z0: 17, z1: 19
  });
  world.setVoxel(Ground, {
    position: { x: 15, y: 3, z: 18 },
    blockId: TransparencyBlock.Ruby
  });
}

function buildFoliagePair(
  world: VoxelWorld
): void {
  const { Foliage } = TransparencyLayer;

  buildTree(world, 6, TransparencyBlock.LeavesSolid);
  buildTree(world, 15, TransparencyBlock.Leaves);

  fillBox(world, Foliage, TransparencyBlock.GrateSolid, {
    x0: 4, x1: 8, y0: 2, y1: 4, z0: 9, z1: 9
  });
  fillBox(world, Foliage, TransparencyBlock.Grate, {
    x0: 13, x1: 17, y0: 2, y1: 4, z0: 9, z1: 9
  });
}

function buildTree(
  world: VoxelWorld,
  x: number,
  leaves: number
): void {
  const { Foliage } = TransparencyLayer;
  const z = 5;

  fillBox(world, Foliage, TransparencyBlock.Log, {
    x0: x, x1: x, y0: 2, y1: 6, z0: z, z1: z
  });
  fillBox(world, Foliage, leaves, {
    x0: x - 2, x1: x + 2, y0: 5, y1: 6, z0: z - 2, z1: z + 2
  });
  for (const [cx, cz] of [[-2, -2], [-2, 2], [2, -2], [2, 2]]) {
    clearBox(world, Foliage, {
      x0: x + cx, x1: x + cx, y0: 5, y1: 6, z0: z + cz, z1: z + cz
    });
  }
  fillBox(world, Foliage, leaves, {
    x0: x - 1, x1: x + 1, y0: 7, y1: 7, z0: z - 1, z1: z + 1
  });
}

export function buildScene(
  world: VoxelWorld
): void {
  for (const name of TRANSPARENCY_LAYERS) {
    world.addLayer(name);
  }

  buildGround(world);
  buildWater(world);
  buildGreenhouse(world);
  buildFoliagePair(world);
}
