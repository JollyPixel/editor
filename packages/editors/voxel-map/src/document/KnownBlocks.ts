// Import Third-party Dependencies
import type {
  ResolvedBlockDefinition,
  ResolvedTileRef,
  VoxelBlockCommand
} from "@jolly-pixel/voxel.renderer";

export type BlockRegistryChange =
  | "added"
  | "redefined"
  | "retiled"
  | "removed"
  | "moved"
  | "reset";

export class KnownBlocks {
  #blocks = new Map<number, ResolvedBlockDefinition>();

  reset(
    blocks: Iterable<ResolvedBlockDefinition>
  ): void {
    this.#blocks = new Map(
      Array.from(blocks, (block) => [block.id, block])
    );
  }

  record(
    command: VoxelBlockCommand
  ): BlockRegistryChange {
    switch (command.action) {
      case "block-defined": {
        const { block } = command;
        const previous = this.#blocks.get(block.id);
        this.#blocks.set(block.id, block);
        if (previous === undefined) {
          return "added";
        }

        return framesMatch(previous, block) ? "retiled" : "redefined";
      }
      case "block-removed":
        this.#blocks.delete(command.blockId);

        return "removed";
      default:
        return "moved";
    }
  }
}

function framesMatch(
  left: ResolvedBlockDefinition,
  right: ResolvedBlockDefinition
): boolean {
  return frameOf(left) === frameOf(right);
}

function frameOf(
  block: ResolvedBlockDefinition
): string {
  const {
    defaultTexture,
    faceTextures,
    ...rest
  } = block;

  return JSON.stringify([
    sortedEntries(rest),
    defaultTexture && tileFrameOf(defaultTexture),
    sortedEntries(faceTextures).map(([slot, tile]) => [slot, tileFrameOf(tile)])
  ]);
}

function tileFrameOf(
  tile: ResolvedTileRef
): [string | null, number] {
  return [tile.tilesetId ?? null, tile.rotation ?? 0];
}

function sortedEntries<T>(
  record: Record<string, T>
): Array<[string, T]> {
  return Object.entries(record).sort(
    ([left], [right]) => (left < right ? -1 : 1)
  );
}
