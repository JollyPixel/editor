// Import Internal Dependencies
import type { VoxelEngine } from "../../../src/index.ts";
import { TransparencyBlock } from "./transparencyAtlas.ts";

// CONSTANTS
/** Width and depth of the diorama, in voxels. */
export const WORLD_SIZE = 24;

export interface LayerSpec {
  name: TransparencyLayerName;
  opacity: number;
  /** Shown in the HUD next to the layer's own controls. */
  hint: string;
}

export interface SceneLabel {
  text: string;
  x: number;
  y: number;
  z: number;
}

interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

export const TransparencyLayer = {
  Ground: "Ground",
  Water: "Water",
  Glass: "Glass",
  /**
   * Fully opaque: the cutout blocks on it carry `transparent: true`
   * themselves, which is the per-block half of the story.
   */
  Foliage: "Foliage"
} as const;

export type TransparencyLayerName =
  typeof TransparencyLayer[keyof typeof TransparencyLayer];

/** Creation order is compositing order: later layers win over earlier ones. */
export const LAYER_SPECS: readonly LayerSpec[] = [
  { name: TransparencyLayer.Ground, opacity: 1, hint: "opaque" },
  { name: TransparencyLayer.Water, opacity: 0.55, hint: "blended" },
  { name: TransparencyLayer.Glass, opacity: 0.35, hint: "blended" },
  { name: TransparencyLayer.Foliage, opacity: 1, hint: "cutout" }
];

/**
 * Anchored above whatever each part of the diorama is meant to prove. The
 * camera starts on the +Z side, so the blended pieces sit at the front and the
 * tall cutout trees at the back — nothing solid stands in front of the glass.
 */
export const SCENE_LABELS: readonly SceneLabel[] = [
  { text: "water · layer opacity", x: 5.5, y: 5.2, z: 18.5 },
  { text: "glass · layer opacity", x: 15, y: 7.2, z: 18 },
  { text: "cutout WITHOUT transparent: true", x: 6, y: 9.6, z: 5 },
  { text: "same cutout, transparent: true", x: 15, y: 9.6, z: 5 },
  { text: "alphaTest probe (alpha 0 → 1)", x: 20.5, y: 5, z: 11.5 },
  { text: "shapes · sun angle", x: 4, y: 4, z: 11 },
  { text: "cutout in a solid wall", x: 20.5, y: 5.6, z: 21 }
];

function fill(
  engine: VoxelEngine,
  layerName: string,
  blockId: number,
  box: Box
): void {
  for (let x = box.x0; x <= box.x1; x++) {
    for (let y = box.y0; y <= box.y1; y++) {
      for (let z = box.z0; z <= box.z1; z++) {
        engine.setVoxel(layerName, { position: { x, y, z }, blockId });
      }
    }
  }
}

function clear(
  engine: VoxelEngine,
  layerName: string,
  box: Box
): void {
  for (let x = box.x0; x <= box.x1; x++) {
    for (let y = box.y0; y <= box.y1; y++) {
      for (let z = box.z0; z <= box.z1; z++) {
        engine.removeVoxel(layerName, { position: { x, y, z } });
      }
    }
  }
}

/** Perimeter of `box` at every y it spans, leaving the inside untouched. */
function walls(
  engine: VoxelEngine,
  layerName: string,
  blockId: number,
  box: Box
): void {
  fill(engine, layerName, blockId, { ...box, z1: box.z0 });
  fill(engine, layerName, blockId, { ...box, z0: box.z1 });
  fill(engine, layerName, blockId, { ...box, x1: box.x0 });
  fill(engine, layerName, blockId, { ...box, x0: box.x1 });
}

/**
 * Terrain, plus a sunken pool. The pool walls are what makes the water worth
 * looking at: their inner faces only exist because a translucent neighbour
 * does not occlude.
 */
function buildGround(
  engine: VoxelEngine
): void {
  const { Ground } = TransparencyLayer;
  const last = WORLD_SIZE - 1;

  fill(engine, Ground, TransparencyBlock.Stone, {
    x0: 0, x1: last, y0: 0, y1: 0, z0: 0, z1: last
  });
  fill(engine, Ground, TransparencyBlock.Grass, {
    x0: 0, x1: last, y0: 1, y1: 1, z0: 0, z1: last
  });

  // Pool: plank rim and walls around a sand bottom.
  const pool = { x0: 2, x1: 9, y0: 1, y1: 1, z0: 15, z1: 22 };
  fill(engine, Ground, TransparencyBlock.Plank, pool);
  fill(engine, Ground, TransparencyBlock.Sand, {
    ...pool, x0: 3, x1: 8, z0: 16, z1: 21
  });
  walls(engine, Ground, TransparencyBlock.Plank, { ...pool, y0: 2, y1: 3 });

  buildShapeCluster(engine);
  buildAlphaProbes(engine);
  buildWindowWall(engine);
}

/**
 * Slanted and partial shapes lit by the same sun as the cubes — a wrong normal
 * shows up here long before it does on a flat floor.
 */
function buildShapeCluster(
  engine: VoxelEngine
): void {
  const { Ground } = TransparencyLayer;
  const z = 10;

  for (const rotation of [0, 1, 2, 3] as const) {
    engine.setVoxel(Ground, {
      position: { x: 2 + rotation, y: 2, z },
      blockId: TransparencyBlock.StoneRamp,
      rotation
    });
    engine.setVoxel(Ground, {
      position: { x: 2 + rotation, y: 2, z: z + 2 },
      blockId: TransparencyBlock.StoneStair,
      rotation
    });
  }

  engine.setVoxel(Ground, {
    position: { x: 6, y: 2, z },
    blockId: TransparencyBlock.PlankSlab
  });
  engine.setVoxel(Ground, {
    position: { x: 6, y: 2, z: z + 2 },
    blockId: TransparencyBlock.StonePole
  });
}

/** Four cubes of the alpha-gradient tile, on a plank pedestal. */
function buildAlphaProbes(
  engine: VoxelEngine
): void {
  const { Ground } = TransparencyLayer;

  fill(engine, Ground, TransparencyBlock.Plank, {
    x0: 19, x1: 22, y0: 2, y1: 2, z0: 11, z1: 12
  });
  fill(engine, Ground, TransparencyBlock.AlphaRamp, {
    x0: 19, x1: 22, y0: 3, y1: 3, z0: 11, z1: 12
  });
}

/**
 * A solid wall with cutout windows in it. The holes are texture alpha on an
 * opaque layer, so the wall still occludes whatever sits behind it.
 */
function buildWindowWall(
  engine: VoxelEngine
): void {
  const { Ground } = TransparencyLayer;

  fill(engine, Ground, TransparencyBlock.Plank, {
    x0: 19, x1: 22, y0: 2, y1: 4, z0: 21, z1: 21
  });
  fill(engine, Ground, TransparencyBlock.Window, {
    x0: 20, x1: 21, y0: 3, y1: 3, z0: 21, z1: 21
  });
  // Something to look for through the windows. A block flush against the wall
  // would sit against the window's far face and cull it — the opening needs
  // air behind it for its own frame to be there to see.
  fill(engine, Ground, TransparencyBlock.Ruby, {
    x0: 20, x1: 21, y0: 2, y1: 4, z0: 18, z1: 18
  });
}

/** Two water levels: one pane of blending is never as telling as two. */
function buildWater(
  engine: VoxelEngine
): void {
  fill(engine, TransparencyLayer.Water, TransparencyBlock.Water, {
    x0: 3, x1: 8, y0: 2, y1: 3, z0: 16, z1: 21
  });
}

/**
 * A greenhouse with an opaque cube inside and a doorway in the front wall, so
 * the same interior can be compared through glass and through open air.
 */
function buildGreenhouse(
  engine: VoxelEngine
): void {
  const { Glass, Ground } = TransparencyLayer;
  const box = { x0: 13, x1: 17, y0: 2, y1: 4, z0: 16, z1: 20 };

  walls(engine, Glass, TransparencyBlock.Glass, box);
  fill(engine, Glass, TransparencyBlock.Glass, { ...box, y0: 5, y1: 5 });
  clear(engine, Glass, { x0: 15, x1: 15, y0: 2, y1: 3, z0: 20, z1: 20 });

  fill(engine, Ground, TransparencyBlock.Plank, { ...box, y0: 2, y1: 2, x0: 14, x1: 16, z0: 17, z1: 19 });
  engine.setVoxel(Ground, {
    position: { x: 15, y: 3, z: 18 },
    blockId: TransparencyBlock.Ruby
  });
}

/**
 * One tree and one grate wall per variant, 9 voxels apart on the same layer.
 * Everything is identical but the `transparent` flag on the leaf and grate
 * definitions, so any difference between the two is that flag alone.
 */
function buildFoliagePair(
  engine: VoxelEngine
): void {
  const { Foliage } = TransparencyLayer;

  buildTree(engine, 6, TransparencyBlock.LeavesSolid);
  buildTree(engine, 15, TransparencyBlock.Leaves);

  fill(engine, Foliage, TransparencyBlock.GrateSolid, {
    x0: 4, x1: 8, y0: 2, y1: 4, z0: 9, z1: 9
  });
  fill(engine, Foliage, TransparencyBlock.Grate, {
    x0: 13, x1: 17, y0: 2, y1: 4, z0: 9, z1: 9
  });
}

/**
 * The trunk is fully wrapped by the canopy, and the canopy is two blocks thick:
 * without the flag every touching face is culled, so the holes look into a
 * hollow shell and the trunk is gone.
 */
function buildTree(
  engine: VoxelEngine,
  x: number,
  leaves: number
): void {
  const { Foliage } = TransparencyLayer;
  const z = 5;

  fill(engine, Foliage, TransparencyBlock.Log, {
    x0: x, x1: x, y0: 2, y1: 6, z0: z, z1: z
  });
  fill(engine, Foliage, leaves, {
    x0: x - 2, x1: x + 2, y0: 5, y1: 6, z0: z - 2, z1: z + 2
  });
  for (const [cx, cz] of [[-2, -2], [-2, 2], [2, -2], [2, 2]]) {
    clear(engine, Foliage, {
      x0: x + cx, x1: x + cx, y0: 5, y1: 6, z0: z + cz, z1: z + cz
    });
  }
  fill(engine, Foliage, leaves, {
    x0: x - 1, x1: x + 1, y0: 7, y1: 7, z0: z - 1, z1: z + 1
  });
}

/**
 * Creates every layer of the diorama and fills it. The engine must already
 * know the tileset and the block definitions.
 */
export function buildScene(
  engine: VoxelEngine
): void {
  for (const { name, opacity } of LAYER_SPECS) {
    engine.addLayer(name, { opacity });
  }

  buildGround(engine);
  buildWater(engine);
  buildGreenhouse(engine);
  buildFoliagePair(engine);
}
