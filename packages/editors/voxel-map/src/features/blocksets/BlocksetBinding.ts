// Import Third-party Dependencies
import type { SelectionRect } from "@jolly-pixel/pixel-draw.renderer";
import type {
  BlockDefinition,
  BlockShapeRegistry,
  BlocksetDefinition,
  BlocksetLink,
  BlocksetSlot
} from "@jolly-pixel/voxel.renderer";
import { BlocksetIslands } from "@jolly-pixel/asset.voxel-map/client";
import { RoomGrants } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { EditorMap } from "../../map/EditorMap.ts";
import {
  BLOCKSET_CAPABILITIES,
  type BlocksetGrants
} from "../../access/BlocksetAccess.ts";
import type { LinkedBlockset } from "../../viewer/LinkedBlockset.ts";
import type { OpenedBlockset } from "../../viewer/openBlockset.ts";

export interface BlockWriter {
  defineBlock(block: BlockDefinition): void;
  syncAlphaModes(blocksetId: string, bounds?: SelectionRect): void;
}

export interface BlocksetBindingOptions {
  linked: LinkedBlockset;
  shapes: BlockShapeRegistry;
  editorMap: Pick<EditorMap, "ready" | "subscribe">;
  blocks: Pick<BlockWriter, "syncAlphaModes">;
}

export class BlocksetBinding {
  readonly opened: OpenedBlockset;
  readonly link: BlocksetLink;
  readonly access: BlocksetGrants;
  readonly #linked: LinkedBlockset;
  readonly #editorMap: Pick<EditorMap, "ready">;
  readonly #blocks: Pick<BlockWriter, "syncAlphaModes">;
  readonly #subscriptions: Array<() => void>;
  #disposed = false;

  readonly #onReset = (): void => {
    this.#syncAlphaModes();
  };

  readonly #onSettled = (bounds: SelectionRect): void => {
    this.#syncAlphaModes(bounds);
  };

  constructor(
    options: BlocksetBindingOptions
  ) {
    const { linked } = options;
    const { opened, surface } = linked;

    this.#linked = linked;
    this.#editorMap = options.editorMap;
    this.#blocks = options.blocks;
    this.opened = opened;
    this.link = linked.link;
    this.access = new RoomGrants(opened.room, BLOCKSET_CAPABILITIES);
    this.#subscriptions = [
      new BlocksetIslands({
        blockset: opened.blockset,
        shapes: options.shapes
      }).attachTo(opened.pixels),
      surface.subscribe("reset", this.#onReset),
      surface.subscribe("settled", this.#onSettled),
      options.editorMap.subscribe("reset", this.#onReset)
    ];
    void opened.ready.then(this.#onReset);
  }

  get loaded(): boolean {
    return this.#linked.loaded;
  }

  get slot(): BlocksetSlot {
    return this.link.slot;
  }

  get definition(): BlocksetDefinition {
    return this.#linked.definition;
  }

  dispose(): void {
    this.#disposed = true;
    this.access.dispose();
    for (const unsubscribe of this.#subscriptions) {
      unsubscribe();
    }
  }

  #syncAlphaModes(
    bounds?: SelectionRect
  ): void {
    if (!this.#disposed && this.#editorMap.ready) {
      this.#blocks.syncAlphaModes(this.definition.id, bounds);
    }
  }
}
