// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import {
  ChangeReceipts,
  CommandChange,
  type DocumentResetCause,
  type HistorySource
} from "@jolly-pixel/history";
import {
  isVoxelWorldCommand,
  voxelPatchesRestoring,
  voxelPatchWrites,
  VoxelPatchBuilder,
  type BlockDocumentEvents,
  type VoxelCellChange,
  type VoxelCommand,
  type VoxelCommandContext,
  type VoxelEditRecorder,
  type VoxelWorld,
  type VoxelWorldCommand
} from "@jolly-pixel/voxel.renderer";

export type VoxelChange = CommandChange<VoxelWorldCommand, null>;

export type VoxelEditsEvents = {
  change: (change: VoxelChange) => void;
  reset: (cause: DocumentResetCause) => void;
};

export interface VoxelEditsDocument extends Pick<
  Emitter<BlockDocumentEvents<VoxelCommand>>,
  "on" | "off"
> {
  readonly world: VoxelWorld;
}

export class VoxelEdits implements HistorySource<VoxelWorldCommand, null> {
  readonly receipts = new ChangeReceipts<VoxelChange>();
  readonly world: VoxelWorld;

  #document: VoxelEditsDocument;
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
  #onCommand = (
    command: VoxelCommand,
    context: VoxelCommandContext
  ): void => {
    if (!isVoxelWorldCommand(command)) {
      return;
    }

    switch (context.origin) {
      case "local":
        this.#local(command);
        break;
      case "remote":
        this.#events.emit(
          "change",
          CommandChange.remote(command, null, context.clientId ?? null)
        );
        break;
      case "replay":
        this.#events.emit("change", CommandChange.replay(command, null));
        break;
    }
  };
  #onLoaded = (): void => {
    this.#recorded = [];
    this.#events.emit("reset", "load");
  };

  constructor(
    document: VoxelEditsDocument
  ) {
    this.world = document.world;
    this.#document = document;
    document.on("command", this.#onCommand);
    document.on("loaded", this.#onLoaded);
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

  changeFor(
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

    const layer = this.world.getLayerById(command.layerId);
    if (layer === undefined) {
      return null;
    }

    const inverse = new VoxelPatchBuilder();
    for (const { position, packed, partner } of voxelPatchWrites(command.metadata)) {
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
      this.world.unrecorded(() => this.world.patchVoxels(
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
    this.#document.off("command", this.#onCommand);
    this.#document.off("loaded", this.#onLoaded);
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

    const change = CommandChange.local(
      command,
      null,
      revertingCommands(recorded)
    );
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
      this.world.addRecorder(this.#recorder);
    }
    else {
      this.world.removeRecorder(this.#recorder);
    }
  }
}

function revertingCommands(
  changes: readonly VoxelCellChange[]
): VoxelWorldCommand[] {
  const patches = voxelPatchesRestoring(changes, "before");

  return Array.from(patches, ([layerId, metadata]) => {
    return {
      action: "voxels-patched",
      layerId,
      metadata
    };
  });
}
