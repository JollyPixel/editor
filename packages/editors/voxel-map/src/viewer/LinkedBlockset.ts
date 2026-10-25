// Import Third-party Dependencies
import {
  BlocksetLink,
  BlocksetSlot,
  type BlocksetDefinition,
  type BlocksetLinkTarget,
  type VoxelView
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { BlocksetAtlasBridge } from "./BlocksetAtlasBridge.ts";
import type { BlocksetEntry } from "./BlocksetEntry.ts";
import { BlocksetSurface } from "./BlocksetSurface.ts";
import type { OpenedBlockset } from "./openBlockset.ts";

export type LinkedBlocksetHook = (linked: LinkedBlockset) => () => void;

export interface LinkedBlocksetOptions {
  document: BlocksetLinkTarget;
  entry: BlocksetEntry;
  slot: number;
  opened: OpenedBlockset;
  onLink?: LinkedBlocksetHook;
}

export class LinkedBlockset {
  readonly assetId: string | null;
  readonly opened: OpenedBlockset;
  readonly link: BlocksetLink;
  readonly surface: BlocksetSurface;
  readonly #bridges = new Map<VoxelView, BlocksetAtlasBridge>();
  readonly #unlink: () => void;
  #definition: BlocksetDefinition;
  #loaded = false;

  constructor(
    options: LinkedBlocksetOptions
  ) {
    const { entry, opened } = options;

    this.assetId = entry.assetId;
    this.opened = opened;
    this.#definition = entry.definition;
    this.link = new BlocksetLink({
      document: options.document,
      blockset: opened.blockset,
      slot: new BlocksetSlot({
        id: entry.definition.id,
        slot: options.slot
      })
    });
    this.surface = new BlocksetSurface({
      pixels: opened.pixels,
      blockset: opened.blockset
    });
    void opened.ready.then(() => {
      this.#loaded = true;
    });
    this.#unlink = options.onLink?.(this) ?? (() => undefined);
  }

  get loaded(): boolean {
    return this.#loaded;
  }

  get slot(): BlocksetSlot {
    return this.link.slot;
  }

  get definition(): BlocksetDefinition {
    return this.#definition;
  }

  boundTo(
    entry: BlocksetEntry
  ): boolean {
    return this.assetId === entry.assetId &&
      this.slot.slot === entry.definition.slot;
  }

  update(
    definition: BlocksetDefinition
  ): void {
    this.#definition = definition;
    for (const bridge of this.#bridges.values()) {
      bridge.update(definition);
    }
  }

  attach(
    view: VoxelView
  ): void {
    if (this.#bridges.has(view)) {
      return;
    }

    this.#bridges.set(view, new BlocksetAtlasBridge({
      view,
      surface: this.surface,
      definition: this.#definition
    }));
  }

  detach(
    view: VoxelView
  ): void {
    this.#bridges.get(view)?.destroy();
    this.#bridges.delete(view);
  }

  dispose(): void {
    this.#unlink();
    for (const bridge of this.#bridges.values()) {
      bridge.destroy();
    }
    this.#bridges.clear();
    this.surface.dispose();
    this.link.dispose();
    this.opened.release();
  }
}
