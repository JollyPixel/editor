// Import Third-party Dependencies
import type {
  BlockRegistry,
  ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";
import { Emitter } from "@openally/emitt";

export type SelectableBlocks = Pick<BlockRegistry, "get" | "has" | "getAll">;

export type BlockSelectionEvents = {
  change: (id: number | null) => void;
};

export class BlockSelection extends Emitter<BlockSelectionEvents> {
  #id: number | null = null;

  get id(): number | null {
    return this.#id;
  }

  set id(
    id: number | null
  ) {
    if (this.#id === id) {
      return;
    }

    this.#id = id;
    this.emit("change", id);
  }

  resolve(
    blocks: SelectableBlocks
  ): ResolvedBlockDefinition | undefined {
    return this.#id === null ? undefined : blocks.get(this.#id);
  }

  reconcile(
    blocks: SelectableBlocks
  ): void {
    if (this.#id !== null && blocks.has(this.#id)) {
      return;
    }

    const [first] = blocks.getAll();
    this.id = first?.id ?? null;
  }
}
