// Import Third-party Dependencies
import {
  BlocksetSlot,
  decodeBlocksetSlot,
  type BlocksetLink,
  type VoxelDocument
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { AssetOpening } from "../GolemAsset.ts";
import { UnknownBlockError } from "./errors/UnknownBlockError.ts";
import type { BlocksetAsset } from "./BlocksetAsset.ts";

export interface MapBlockset {
  id: string;
  slot: number | null;
  assetId: string | null;
  linked: boolean;
  /**
   * Why the blockset asset could not be opened.
   */
  error?: string;
}

export interface MapBlock {
  id: number;
  name: string;
  shapeId: string;
  blockset: string | null;
}

export type BlockResolver = (block: string | number) => number;

interface LinkedBlockset {
  readonly asset: BlocksetAsset;
  readonly link: BlocksetLink;
}

export class MapBlocksets {
  #voxels: VoxelDocument;
  #open: AssetOpening["open"];
  #linked = new Map<string, LinkedBlockset>();
  #errors = new Map<string, string>();

  constructor(
    voxels: VoxelDocument,
    open: AssetOpening["open"]
  ) {
    this.#voxels = voxels;
    this.#open = open;
  }

  async link(): Promise<void> {
    for (const [id, { asset, link }] of this.#linked) {
      const definition = this.#voxels.blocksets.get(id);
      const bound = !asset.closed &&
        definition?.asset?.id === asset.id &&
        definition.slot === link.slot.slot;
      if (!bound) {
        link.dispose();
        this.#linked.delete(id);
      }
    }

    for (const definition of this.#voxels.blocksets) {
      const { asset, slot } = definition;
      if (asset === undefined || slot === undefined || this.#linked.has(definition.id)) {
        continue;
      }

      this.#errors.delete(definition.id);
      try {
        const blockset = await this.#open(asset.id, "blockset");
        this.#linked.set(definition.id, {
          asset: blockset,
          link: blockset.link(this.#voxels, new BlocksetSlot({
            id: definition.id,
            slot
          }))
        });
      }
      catch (error) {
        this.#errors.set(definition.id, (error as Error).message);
      }
    }
  }

  async resolver(): Promise<BlockResolver> {
    await this.link();

    return (block) => this.#resolve(block);
  }

  list(): MapBlockset[] {
    return Array.from(this.#voxels.blocksets, (definition) => {
      const error = this.#errors.get(definition.id);

      return {
        id: definition.id,
        slot: definition.slot ?? null,
        assetId: definition.asset?.id ?? null,
        linked: this.#linked.has(definition.id),
        ...(error === undefined ? {} : { error })
      };
    });
  }

  blocks(): MapBlock[] {
    return Array.from(this.#voxels.blocks, (block) => {
      return {
        id: block.id,
        name: block.name,
        shapeId: block.shapeId,
        blockset: this.#voxels.blocksets.findBySlot(
          decodeBlocksetSlot(block.id)
        )?.id ?? null
      };
    });
  }

  dispose(): void {
    for (const { link } of this.#linked.values()) {
      link.dispose();
    }
    this.#linked.clear();
  }

  #resolve(
    block: string | number
  ): number {
    if (typeof block === "number") {
      if (this.#voxels.blocks.get(block) === undefined) {
        throw new UnknownBlockError(block, []);
      }

      return block;
    }

    const qualifier = block.lastIndexOf("/");
    const blockset = qualifier === -1 ? null : block.slice(0, qualifier);
    const name = block.slice(qualifier + 1);
    const matches = this.blocks().filter((candidate) => candidate.name === name &&
      (blockset === null || candidate.blockset === blockset));
    if (matches.length !== 1) {
      throw new UnknownBlockError(
        block,
        matches.map((match) => `${match.blockset}/${match.name} (${match.id})`)
      );
    }

    return matches[0].id;
  }
}
