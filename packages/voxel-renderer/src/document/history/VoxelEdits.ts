// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import {
  ChangeReceipts,
  CommandChange,
  type DocumentResetCause,
  type HistorySource
} from "@jolly-pixel/history";

// Import Internal Dependencies
import type { BlockDocumentEvents } from "../BlockDocument.ts";
import { isVoxelWorldCommand } from "../commands/categories.ts";
import type {
  VoxelCommand,
  VoxelCommandContext,
  VoxelWorldCommand
} from "../commands/types.ts";
import type { VoxelWorld } from "../world/VoxelWorld.ts";
import type {
  VoxelCellChange,
  VoxelEditRecorder
} from "../world/types.ts";
import { VoxelPatchBuilder } from "../world/editing/VoxelPatchBuilder.ts";
import { patchCells } from "./patchCells.ts";

export type VoxelChange = CommandChange<VoxelWorldCommand, null>;

export type VoxelEditsEvents = {
  change: (change: VoxelChange) => void;
  reset: (cause: DocumentResetCause) => void;
};

export type VoxelEditsDocument = Pick<
  Emitter<BlockDocumentEvents<VoxelCommand>>,
  "on"
>;

export class VoxelEdits implements HistorySource<VoxelWorldCommand, null> {
  readonly receipts = new ChangeReceipts<VoxelChange>();

  #world: VoxelWorld;
  #events = new Emitter<VoxelEditsEvents>();
  #changes = new WeakMap<VoxelWorldCommand, VoxelChange>();
  #recorded: VoxelCellChange[] = [];
  #recorder: VoxelEditRecorder = {
    record: (changes) => {
      for (const change of changes) {
        this.#recorded.push(change);
      }
    }
  };
  #recording = false;
  #stepping: VoxelChange | null = null;

  constructor(
    world: VoxelWorld,
    document: VoxelEditsDocument
  ) {
    this.#world = world;
    world.on("command", (command) => this.#local(command));
    document.on("command", (command, context) => {
      if (isVoxelWorldCommand(command) && !this.#changes.has(command)) {
        this.#events.emit("change", changeOf(command, context));
      }
    });
    document.on("loaded", () => {
      this.#recorded = [];
      this.#events.emit("reset", "load");
    });
  }

  subscribe<TEvent extends keyof VoxelEditsEvents>(
    event: TEvent,
    listener: VoxelEditsEvents[TEvent]
  ): () => void {
    const unsubscribe = this.#events.subscribe(event, listener);
    this.#follow();

    return () => {
      unsubscribe();
      this.#follow();
    };
  }

  changeOf(
    command: VoxelWorldCommand
  ): VoxelChange | undefined {
    return this.#changes.get(command);
  }

  applyStep(
    command: VoxelWorldCommand,
    basis: number | undefined
  ): VoxelChange | null {
    if (command.action !== "voxels-patched") {
      return null;
    }

    const layer = this.#world.getLayerById(command.layerId);
    if (layer === undefined) {
      return null;
    }

    const inverse = new VoxelPatchBuilder();
    for (const { position, packed, partner } of patchCells(command.metadata)) {
      const before = layer.getPackedVoxelAt(position);
      const beforePartner = layer.getPartnerVoxelAt(position);
      if (before !== packed || beforePartner !== partner) {
        inverse.push(position, before, beforePartner);
      }
    }
    if (inverse.cellCount === 0) {
      return null;
    }

    const change = CommandChange.local<VoxelWorldCommand, null>(
      command,
      null,
      [
        {
          action: "voxels-patched",
          layerId: layer.id,
          metadata: inverse.toPatch()
        }
      ],
      basis
    );
    this.#stepping = change;
    try {
      this.#world.unrecorded(() => this.#world.patchVoxels(
        layer.name,
        command.metadata.cells,
        command.metadata.partners
      ));
    }
    finally {
      this.#stepping = null;
    }
    this.#events.emit("change", change);

    return change;
  }

  dispose(): void {
    this.#events.removeAllListeners();
    this.#follow();
  }

  #local(
    command: VoxelWorldCommand
  ): void {
    const recorded = this.#recorded;
    this.#recorded = [];
    if (this.#stepping !== null) {
      this.#changes.set(command, this.#stepping);

      return;
    }

    const change = CommandChange.local(command, null, inverseOf(recorded));
    this.#changes.set(command, change);
    this.#events.emit("change", change);
  }

  #follow(): void {
    const recording = this.#events.listenerCount("change") > 0;
    if (recording === this.#recording) {
      return;
    }

    this.#recording = recording;
    this.#recorded = [];
    if (recording) {
      this.#world.addRecorder(this.#recorder);
    }
    else {
      this.#world.removeRecorder(this.#recorder);
    }
  }
}

function inverseOf(
  changes: readonly VoxelCellChange[]
): VoxelWorldCommand[] {
  const patches = new Map<string, VoxelPatchBuilder>();
  for (let index = changes.length - 1; index >= 0; index--) {
    const { layerId, position, before, beforePartner } = changes[index];
    let patch = patches.get(layerId);
    if (patch === undefined) {
      patch = new VoxelPatchBuilder();
      patches.set(layerId, patch);
    }
    patch.push(position, before, beforePartner);
  }

  return Array.from(patches, ([layerId, patch]) => {
    return {
      action: "voxels-patched",
      layerId,
      metadata: patch.toPatch()
    };
  });
}

function changeOf(
  command: VoxelWorldCommand,
  context: VoxelCommandContext
): VoxelChange {
  switch (context.origin) {
    case "local":
      return CommandChange.local(command, null);
    case "remote":
      return CommandChange.remote(command, null, context.clientId ?? null);
    case "replay":
      return CommandChange.replay(command, null);
  }
}
