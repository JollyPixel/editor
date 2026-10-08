export const TerrainBlock = {
  Grass: 1,
  Dirt: 2,
  Stone: 3,
  Sand: 4,
  Snow: 5,
  Water: 6,
  Log: 7,
  Leaves: 8,
  PineLeaves: 9,
  BirchLog: 10,
  BirchLeaves: 11
} as const;
export type TerrainBlockId = typeof TerrainBlock[keyof typeof TerrainBlock];

export interface TerrainPosition {
  x: number;
  y: number;
  z: number;
}

export type TerrainWriter = (
  position: TerrainPosition,
  blockId: TerrainBlockId
) => void;
