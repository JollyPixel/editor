// Import Internal Dependencies
import type { VoxelEntry } from "../world/types.ts";
import type { LayerChunkCache } from "./ChunkNeighbourhood.ts";
import type { BlockVariantCache } from "./BlockVariantCache.ts";

/**
 * True when `entry` is the voxel the world composites at (wx, wy, wz) — i.e.
 * no higher-priority layer covers the position.
 *
 * `selfIndex` is the owning layer's rank among the effectively visible layers,
 * so only the layers above it need a lookup. It is -1 when the layer is hidden
 * or fully transparent, in which case another layer always wins and every voxel
 * is skipped.
 */
// eslint-disable-next-line max-params
export function winsCompositing(
  layers: readonly LayerChunkCache[],
  layerCount: number,
  selfIndex: number,
  entry: VoxelEntry,
  wx: number,
  wy: number,
  wz: number
): boolean {
  for (let i = 0; i < layerCount; i++) {
    if (i === selfIndex) {
      return true;
    }

    const found = layers[i].entryAt(wx, wy, wz);
    if (found !== undefined) {
      return found === entry;
    }
  }

  return false;
}

/**
 * True when the neighbour voxel exists, belongs to a fully opaque layer
 * (opacity 1), and its shape occludes `oppFace` — the world-space face pointing
 * back toward the voxel being meshed. False when the neighbour is empty, its
 * owning layer is translucent (opacity < 1, e.g. glass — never occludes), or
 * its shape does not occlude that face.
 */
// eslint-disable-next-line max-params
export function isNeighbourFaceHidden(
  variants: BlockVariantCache,
  layers: readonly LayerChunkCache[],
  layerCount: number,
  nx: number,
  ny: number,
  nz: number,
  oppFace: number
): boolean {
  for (let i = 0; i < layerCount; i++) {
    const cache = layers[i];
    const neighbour = cache.entryAt(nx, ny, nz);
    if (neighbour === undefined) {
      continue;
    }
    if (!cache.opaque) {
      return false;
    }

    const variant = variants.get(neighbour.blockId, neighbour.transform);

    return variant !== null && (variant.occlusionMask & (1 << oppFace)) !== 0;
  }

  return false;
}
