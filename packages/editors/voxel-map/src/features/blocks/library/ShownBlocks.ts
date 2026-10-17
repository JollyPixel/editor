// Import Third-party Dependencies
import type { ResolvedBlockDefinition } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { BlockMoveDetail } from "./BlockReorderController.ts";

export class ShownBlocks {
  static readonly Empty = new ShownBlocks([], []);

  readonly registry: readonly ResolvedBlockDefinition[];
  readonly blocks: ResolvedBlockDefinition[];

  constructor(
    registry: readonly ResolvedBlockDefinition[],
    blocks: ResolvedBlockDefinition[]
  ) {
    this.registry = registry;
    this.blocks = blocks;
  }

  update(
    registry: readonly ResolvedBlockDefinition[],
    blocks: ResolvedBlockDefinition[]
  ): ShownBlocks {
    const unchanged = blocks.length === this.blocks.length &&
      blocks.every((block, index) => block === this.blocks[index]);
    if (unchanged && registry === this.registry) {
      return this;
    }

    return new ShownBlocks(registry, unchanged ? this.blocks : blocks);
  }

  registryIndex(
    move: BlockMoveDetail
  ): number {
    const others = this.blocks.filter((block) => block.id !== move.id);
    const rest = this.registry.filter((block) => block.id !== move.id);
    const anchor = others[move.toIndex];
    if (anchor !== undefined) {
      return rest.indexOf(anchor);
    }

    const last = others.at(-1);

    return last === undefined ? rest.length : rest.indexOf(last) + 1;
  }
}
