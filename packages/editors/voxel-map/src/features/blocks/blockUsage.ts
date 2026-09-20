// Import Third-party Dependencies
import {
  voxelBlockId,
  type ResolvedBlockDefinition,
  type VoxelBlockUsage,
  type VoxelRemoveOptions,
  type VoxelTilesetUsage,
  type VoxelWorld
} from "@jolly-pixel/voxel.renderer";

// CONSTANTS
const kRemoveBatchSize = 4096;
const kNumberFormat = new Intl.NumberFormat("en-US");

export function formatCount(
  count: number,
  singular: string,
  plural = `${singular}s`
): string {
  return `${kNumberFormat.format(count)} ${count === 1 ? singular : plural}`;
}

export function sortBlocksByUsage(
  blocks: readonly ResolvedBlockDefinition[],
  counts: ReadonlyMap<number, number>
): ResolvedBlockDefinition[] {
  return blocks
    .map((block, index) => {
      return {
        block,
        index,
        count: counts.get(block.id) ?? 0
      };
    })
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .map(({ block }) => block);
}

export function blockUsageSummary(
  usage: VoxelBlockUsage
): string {
  if (usage.voxels === 0) {
    return "Not placed in the map";
  }

  return `${formatCount(usage.voxels, "voxel")} in ` +
    formatCount(usage.layers.length, "layer");
}

export function blockIsUnused(
  usage: VoxelBlockUsage
): boolean {
  return usage.voxels === 0;
}

export function tilesetIsUnused(
  usage: VoxelTilesetUsage
): boolean {
  return usage.blocks.length === 0 && usage.voxels === 0;
}

export function blockRemovalMessage(
  usage: VoxelBlockUsage
): string {
  if (usage.voxels === 0) {
    return "No voxel uses this block.";
  }

  return `Used by ${blockUsageSummary(usage)}. ` +
    "Those voxels stay in the map but are no longer drawn.";
}

export function tilesetRemovalMessage(
  usage: VoxelTilesetUsage
): string {
  const count = usage.blocks.length;
  if (count === 0) {
    return "No block uses this tileset.";
  }

  const placed = usage.voxels === 0 ?
    "none placed in the map" :
    `${formatCount(usage.voxels, "voxel")} in the map`;
  const verb = count === 1 ?
    "uses this tileset and will lose its texture" :
    "use this tileset and will lose their texture";

  return `${formatCount(count, "block")} (${placed}) ${verb}.`;
}

export function orphanVoxelsMessage(
  voxels: number,
  blockIds: readonly number[]
): string {
  const ids = blockIds.map((id) => `#${id}`).join(", ");

  return `${formatCount(voxels, "voxel")} of deleted blocks (${ids}) ` +
    "cannot be drawn. Remove them from every layer?";
}

export function removeBlockVoxels(
  world: VoxelWorld,
  blockIds: ReadonlySet<number>
): number {
  let removed = 0;

  for (const layer of [...world.getLayers()]) {
    const entries: VoxelRemoveOptions[] = [];
    for (const chunk of layer.getChunks()) {
      const counts = chunk.countBlocks();
      if (![...blockIds].some((id) => counts.has(id))) {
        continue;
      }

      const x0 = (chunk.cx * chunk.size) + layer.position.x;
      const y0 = (chunk.cy * chunk.size) + layer.position.y;
      const z0 = (chunk.cz * chunk.size) + layer.position.z;
      for (const [index, packed] of chunk.packedEntries()) {
        if (!blockIds.has(voxelBlockId(packed))) {
          continue;
        }

        const { lx, ly, lz } = chunk.fromLinearIndex(index);
        entries.push({
          position: {
            x: x0 + lx,
            y: y0 + ly,
            z: z0 + lz
          }
        });
      }
    }

    for (let start = 0; start < entries.length; start += kRemoveBatchSize) {
      world.removeVoxelBulk(
        layer.name,
        entries.slice(start, start + kRemoveBatchSize)
      );
    }
    removed += entries.length;
  }

  return removed;
}
