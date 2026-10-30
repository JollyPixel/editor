// Import Internal Dependencies
import { ChunkCoord } from "./ChunkCoord.ts";
import type { TerrainReader } from "./Terrain.ts";

export function pointHeight(
  terrain: TerrainReader,
  x: number,
  z: number
): number {
  const coord = ChunkCoord.containing(x, z);
  const chunk = terrain.chunk(coord);
  if (chunk === undefined) {
    return terrain.knows(coord) ?
      terrain.overview.interpolate(x, z) ?? terrain.sampleAt(Math.round(x), Math.round(z)) :
      terrain.sampleAt(Math.round(x), Math.round(z));
  }

  const { tier, resolution } = chunk;
  const origin = coord.originSample;
  const gridX = (x - origin.x) * tier;
  const gridZ = (z - origin.z) * tier;
  const x0 = Math.floor(gridX);
  const z0 = Math.floor(gridZ);
  const fx = gridX - x0;
  const fz = gridZ - z0;
  function at(
    sampleX: number,
    sampleZ: number
  ): number {
    return sampleX < resolution && sampleZ < resolution ?
      chunk!.sample(sampleX, sampleZ) :
      pointHeight(terrain, origin.x + sampleX / tier, origin.z + sampleZ / tier);
  }
  if (fx === 0 && fz === 0) {
    return at(x0, z0);
  }

  const near = fx === 0 ? at(x0, z0) : at(x0, z0) * (1 - fx) + at(x0 + 1, z0) * fx;
  if (fz === 0) {
    return near;
  }

  const far = fx === 0 ? at(x0, z0 + 1) : at(x0, z0 + 1) * (1 - fx) + at(x0 + 1, z0 + 1) * fx;

  return near * (1 - fz) + far * fz;
}
