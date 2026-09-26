// Import Internal Dependencies
import {
  TerrainBlock,
  type TerrainBlockId,
  type TerrainPosition,
  type TerrainWriter
} from "./blocks.ts";
import { hash2D } from "./noise.ts";

// CONSTANTS
export const TREE_MAX_RADIUS = 6;

export type TreeSpecies = "oak" | "birch" | "pine" | "bush";

interface Canopy {
  centreY: number;
  radius: number;
  height: number;
  blockId: TerrainBlockId;
  offsetX?: number;
}

interface TreeContext {
  write: TerrainWriter;
  origin: TerrainPosition;
  seed: number;
  written: number;
}

export function plantTree(
  write: TerrainWriter,
  species: TreeSpecies,
  origin: TerrainPosition,
  seed: number
): number {
  const context: TreeContext = {
    write,
    origin,
    seed,
    written: 0
  };

  switch (species) {
    case "oak":
      plantOak(context);
      break;
    case "birch":
      plantBirch(context);
      break;
    case "pine":
      plantPine(context);
      break;
    case "bush":
      plantBush(context);
      break;
  }

  return context.written;
}

function plantOak(
  context: TreeContext
): void {
  const trunk = 4 + Math.floor(roll(context, 1) * 3);
  const radius = 2.5 + (roll(context, 2) * 1.5);
  const top = context.origin.y + trunk;

  column(context, trunk + 1, TerrainBlock.Log);
  ellipsoid(context, {
    centreY: top,
    radius,
    height: radius * 0.75,
    blockId: TerrainBlock.Leaves
  });
  if (roll(context, 3) > 0.5) {
    const side = roll(context, 4) > 0.5 ? 1 : -1;
    ellipsoid(context, {
      centreY: top - 1,
      radius: radius * 0.6,
      height: radius * 0.5,
      blockId: TerrainBlock.Leaves,
      offsetX: side * Math.round(radius * 0.8)
    });
  }
}

function plantBirch(
  context: TreeContext
): void {
  const trunk = 5 + Math.floor(roll(context, 1) * 4);
  const radius = 1.8 + (roll(context, 2) * 0.8);
  const top = context.origin.y + trunk;

  column(context, trunk, TerrainBlock.BirchLog);
  ellipsoid(context, {
    centreY: top - 1,
    radius,
    height: 2.5 + roll(context, 3),
    blockId: TerrainBlock.BirchLeaves
  });
}

function plantPine(
  context: TreeContext
): void {
  const trunk = 8 + Math.floor(roll(context, 1) * 6);
  const radius = 2.2 + (roll(context, 2) * 1.5);
  const bottom = context.origin.y + 2 + Math.floor(roll(context, 3) * 2);
  const top = context.origin.y + trunk;

  column(context, trunk - 1, TerrainBlock.Log);
  for (let y = bottom; y <= top; y++) {
    const t = (y - bottom) / Math.max(1, top - bottom);
    const tier = (top - y) % 2 === 0 ? 1 : 0.65;
    disc(context, y, 0.6 + (radius * (1 - t) * tier), TerrainBlock.PineLeaves);
  }
  put(context, 0, trunk + 1, 0, TerrainBlock.PineLeaves);
}

function plantBush(
  context: TreeContext
): void {
  const { y } = context.origin;

  disc(context, y, 1 + (roll(context, 1) * 0.6), TerrainBlock.Leaves);
  if (roll(context, 2) > 0.4) {
    put(context, 0, 1, 0, TerrainBlock.Leaves);
  }
}

function column(
  context: TreeContext,
  length: number,
  blockId: TerrainBlockId
): void {
  for (let dy = 0; dy < length; dy++) {
    put(context, 0, dy, 0, blockId);
  }
}

function ellipsoid(
  context: TreeContext,
  canopy: Canopy
): void {
  const { centreY, radius, height, blockId, offsetX = 0 } = canopy;
  const reach = Math.ceil(radius);
  const rise = Math.ceil(height);

  for (let dy = -rise; dy <= rise; dy++) {
    for (let dz = -reach; dz <= reach; dz++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const distance = Math.hypot(
          dx / (radius + 0.5),
          dy / (height + 0.5),
          dz / (radius + 0.5)
        );
        const jitter = lumpHash(context, offsetX + dx, dy, dz) * 0.35;
        if (distance + jitter < 1.05) {
          put(context, offsetX + dx, centreY - context.origin.y + dy, dz, blockId);
        }
      }
    }
  }
}

function disc(
  context: TreeContext,
  y: number,
  radius: number,
  blockId: TerrainBlockId
): void {
  const reach = Math.ceil(radius);

  for (let dz = -reach; dz <= reach; dz++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const rim = radius + ((lumpHash(context, dx, y, dz) - 0.5) * 0.6);
      if (Math.hypot(dx, dz) <= rim) {
        put(context, dx, y - context.origin.y, dz, blockId);
      }
    }
  }
}

function put(
  context: TreeContext,
  dx: number,
  dy: number,
  dz: number,
  blockId: TerrainBlockId
): void {
  const { x, y, z } = context.origin;

  context.write({ x: x + dx, y: y + dy, z: z + dz }, blockId);
  context.written++;
}

function roll(
  context: TreeContext,
  salt: number
): number {
  const { origin, seed } = context;

  return hash2D(origin.x, origin.z, seed + (salt * 7919));
}

function lumpHash(
  context: TreeContext,
  dx: number,
  dy: number,
  dz: number
): number {
  const { origin, seed } = context;

  return hash2D(origin.x + dx + (dy * 131), origin.z + dz, seed ^ 0x5BD1E995);
}
