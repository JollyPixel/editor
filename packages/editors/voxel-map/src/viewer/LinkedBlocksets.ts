// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import {
  isVoxelBlocksetCommand,
  type BlocksetLinkTarget,
  type VoxelCommand,
  type VoxelDocument,
  type VoxelView
} from "@jolly-pixel/voxel.renderer";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { BlocksetEntry } from "./BlocksetEntry.ts";
import {
  LinkedBlockset,
  type LinkedBlocksetHook
} from "./LinkedBlockset.ts";
import type { OpenedBlockset } from "./openBlockset.ts";

export interface BlocksetRecords {
  records(): Iterable<AssetRecordData>;
  on(event: "change", listener: () => void): unknown;
  off(event: "change", listener: () => void): unknown;
}

export type LinkedBlocksetsDocument = BlocksetLinkTarget &
  Pick<VoxelDocument, "blocksets" | "on" | "off">;

export interface LinkedBlocksetsOptions {
  document: LinkedBlocksetsDocument;
  catalog: BlocksetRecords;
  open: (assetId: string) => OpenedBlockset;
  onLink?: LinkedBlocksetHook;
}

export type LinkedBlocksetsEvents = {
  change: () => void;
};

export class LinkedBlocksets extends Emitter<LinkedBlocksetsEvents> {
  readonly #document: LinkedBlocksetsDocument;
  readonly #catalog: BlocksetRecords;
  readonly #open: (assetId: string) => OpenedBlockset;
  readonly #onLink: LinkedBlocksetHook | undefined;
  readonly #linked = new Map<string, LinkedBlockset>();
  readonly #views = new Set<VoxelView>();
  readonly #unwatch: () => void;
  #entries: readonly BlocksetEntry[] = [];

  constructor(
    options: LinkedBlocksetsOptions
  ) {
    super();
    this.#document = options.document;
    this.#catalog = options.catalog;
    this.#open = options.open;
    this.#onLink = options.onLink;

    this.#catalog.on("change", this.refresh);
    this.#unwatch = this.#watchDocument();
    this.refresh();
  }

  get entries(): readonly BlocksetEntry[] {
    return this.#entries;
  }

  attach(
    view: VoxelView
  ): () => void {
    this.#views.add(view);
    for (const linked of this.#linked.values()) {
      linked.attach(view);
    }

    return () => {
      if (this.#views.delete(view)) {
        for (const linked of this.#linked.values()) {
          linked.detach(view);
        }
      }
    };
  }

  readonly refresh = (): void => {
    const entries = BlocksetEntry.resolveAll(
      this.#document.blocksets,
      this.#catalog.records()
    );
    if (
      entries.length === this.#entries.length &&
      entries.every((entry, index) => entry.equals(this.#entries[index]))
    ) {
      return;
    }

    this.#entries = entries;
    this.#reconcile();
    this.emit("change");
  };

  dispose(): void {
    this.#unwatch();
    this.#catalog.off("change", this.refresh);
    for (const [blocksetId, linked] of this.#linked) {
      this.#unbind(blocksetId, linked);
    }
    this.#views.clear();
  }

  #watchDocument(): () => void {
    const document = this.#document;
    const { refresh } = this;
    function onCommand(
      command: VoxelCommand
    ): void {
      if (isVoxelBlocksetCommand(command)) {
        refresh();
      }
    }
    document.on("command", onCommand);
    document.on("loaded", refresh);

    return () => {
      document.off("command", onCommand);
      document.off("loaded", refresh);
    };
  }

  #reconcile(): void {
    const entries = new Map(
      this.#entries.map((entry) => [entry.id, entry])
    );
    for (const [blocksetId, linked] of this.#linked) {
      const entry = entries.get(blocksetId);
      if (entry === undefined || !linked.boundTo(entry)) {
        this.#unbind(blocksetId, linked);
      }
    }

    for (const [blocksetId, entry] of entries) {
      const linked = this.#linked.get(blocksetId);
      if (linked === undefined) {
        this.#bind(entry);
      }
      else {
        linked.update(entry.definition);
      }
    }
  }

  #bind(
    entry: BlocksetEntry
  ): void {
    const { definition, assetId } = entry;
    if (definition.slot === undefined || assetId === null) {
      return;
    }

    let opened: OpenedBlockset;
    try {
      opened = this.#open(assetId);
    }
    catch (error) {
      console.error(
        `LinkedBlocksets: cannot open blockset "${definition.id}"`,
        error
      );

      return;
    }

    const linked = new LinkedBlockset({
      document: this.#document,
      entry,
      slot: definition.slot,
      opened,
      onLink: this.#onLink
    });
    this.#linked.set(definition.id, linked);
    for (const view of this.#views) {
      linked.attach(view);
    }
    void opened.ready.then(() => {
      if (this.#linked.get(definition.id) === linked) {
        this.emit("change");
      }
    });
  }

  #unbind(
    blocksetId: string,
    linked: LinkedBlockset
  ): void {
    this.#linked.delete(blocksetId);
    linked.dispose();
  }
}
