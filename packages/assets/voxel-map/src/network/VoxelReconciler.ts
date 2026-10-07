// Import Third-party Dependencies
import type { CommandReconciler } from "@jolly-pixel/network/client";
import {
  VOXEL_ABSENT,
  VoxelPatchBuilder,
  type PackedVoxel,
  type VoxelCoord,
  type VoxelDocument,
  type VoxelEditRecorder,
  type VoxelLayer,
  type VoxelLayerUpdate
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { VoxelMapNetworkCommand } from "./types.ts";
import {
  isVoxelCellCommand,
  narrowVoxelCellCommand,
  voxelCellKeys,
  voxelCellPositions,
  type VoxelCellCommand
} from "./VoxelCommandKeys.ts";

interface CellImage {
  readonly layerId: string;
  readonly position: VoxelCoord;
  readonly before: PackedVoxel;
  readonly beforePartner: PackedVoxel;
}

interface LayerImage {
  readonly name: string;
  readonly visible: boolean;
  readonly compositing: VoxelLayer["compositing"];
  readonly properties: Record<string, unknown>;
  readonly rank: string;
  readonly position: VoxelCoord;
}

type VoxelInverse =
  | { readonly kind: "cells"; readonly cells: readonly CellImage[]; }
  | { readonly kind: "rank"; readonly layerId: string; readonly rank: string; }
  | {
    readonly kind: "options";
    readonly layerId: string;
    readonly options: VoxelLayerUpdate;
  }
  | {
    readonly kind: "position";
    readonly layerId: string;
    readonly position: VoxelCoord;
  }
  | { readonly kind: "remove"; readonly layerId: string; }
  | { readonly kind: "none"; };

type ImageOf = (layerId: string) => LayerImage | undefined;

export class VoxelReconciler implements CommandReconciler<VoxelMapNetworkCommand> {
  #document: VoxelDocument;
  #inverses = new WeakMap<VoxelMapNetworkCommand, VoxelInverse>();
  #recorded: CellImage[] = [];
  #images: ReadonlyMap<string, LayerImage>;
  #recorder: VoxelEditRecorder = {
    record: (changes) => {
      for (const { layerId, position, before, beforePartner } of changes) {
        this.#recorded.push({
          layerId,
          position,
          before,
          beforePartner
        });
      }
    }
  };

  constructor(
    document: VoxelDocument
  ) {
    this.#document = document;
    this.#images = imagesOf(document);
    document.world.addRecorder(
      this.#recorder,
      { includeUnrecorded: true }
    );
  }

  keys(
    command: VoxelMapNetworkCommand
  ): readonly string[] | null {
    return isVoxelCellCommand(command)
      ? voxelCellKeys(command)
      : null;
  }

  narrow(
    command: VoxelMapNetworkCommand,
    keep: readonly number[]
  ): VoxelMapNetworkCommand | null {
    return isVoxelCellCommand(command) ?
      narrowVoxelCellCommand(command, keep) :
      null;
  }

  capture(
    command: VoxelMapNetworkCommand
  ): void {
    const inverse = isVoxelCellCommand(command) ||
      command.action === "layer-transformed" ?
      { kind: "cells" as const, cells: this.#recorded } :
      structuralInverse(command, (layerId) => this.#images.get(layerId));
    this.#remember(command, inverse);
  }

  observe(): void {
    this.#recorded = [];
    this.#images = imagesOf(this.#document);
  }

  revert(
    pending: readonly VoxelMapNetworkCommand[]
  ): boolean {
    const inverses = pending.map((command) => this.#inverses.get(command));
    if (inverses.some((inverse) => inverse === undefined)) {
      return false;
    }

    for (const inverse of inverses.reverse()) {
      this.#undo(inverse!);
    }

    return true;
  }

  replay(
    command: VoxelMapNetworkCommand
  ): boolean {
    if (command.action === "world-replace") {
      this.#remember(command, { kind: "none" });

      return true;
    }

    const inverse = isVoxelCellCommand(command) ?
      { kind: "cells" as const, cells: this.#cellImages(command) } :
      structuralInverse(command, (layerId) => {
        const layer = this.#document.world.getLayerById(layerId);

        return layer === undefined ? undefined : imageOf(layer);
      });
    const applied = this.#document.apply(
      command,
      { origin: "replay" }
    );
    this.#remember(command, applied ? inverse : null);

    return applied;
  }

  dispose(): void {
    this.#document.world.removeRecorder(this.#recorder);
  }

  #remember(
    command: VoxelMapNetworkCommand,
    inverse: VoxelInverse | null
  ): void {
    if (inverse === null) {
      this.#inverses.delete(command);
    }
    else {
      this.#inverses.set(command, inverse);
    }
  }

  #cellImages(
    command: VoxelCellCommand
  ): CellImage[] {
    const layer = this.#document.world.getLayerById(command.layerId);

    return voxelCellPositions(command).map((position) => {
      return {
        layerId: command.layerId,
        position,
        before: layer?.getPackedVoxelAt(position) ?? VOXEL_ABSENT,
        beforePartner: layer?.getPartnerVoxelAt(position) ?? VOXEL_ABSENT
      };
    });
  }

  #undo(
    inverse: VoxelInverse
  ): void {
    const origin = { origin: "replay" } as const;
    switch (inverse.kind) {
      case "cells":
        this.#restoreCells(inverse.cells);
        break;
      case "rank":
        this.#document.apply({
          action: "layer-moved",
          layerId: inverse.layerId,
          metadata: { rank: inverse.rank }
        }, origin);
        break;
      case "options":
        this.#document.apply({
          action: "updated",
          layerId: inverse.layerId,
          metadata: { options: inverse.options }
        }, origin);
        break;
      case "position":
        this.#document.apply({
          action: "position-updated",
          layerId: inverse.layerId,
          metadata: { position: inverse.position }
        }, origin);
        break;
      case "remove":
        this.#document.apply({
          action: "removed",
          layerId: inverse.layerId,
          metadata: {}
        }, origin);
        break;
      default:
        break;
    }
  }

  #restoreCells(
    images: readonly CellImage[]
  ): void {
    const patches = new Map<string, VoxelPatchBuilder>();
    for (let index = images.length - 1; index >= 0; index--) {
      const { layerId, position, before, beforePartner } = images[index];
      let patch = patches.get(layerId);
      if (patch === undefined) {
        patch = new VoxelPatchBuilder();
        patches.set(layerId, patch);
      }
      patch.push(position, before, beforePartner);
    }

    for (const [layerId, patch] of patches) {
      this.#document.apply({
        action: "voxels-patched",
        layerId,
        metadata: patch.toPatch()
      }, { origin: "replay" });
    }
  }
}

function structuralInverse(
  command: VoxelMapNetworkCommand,
  imageOfLayer: ImageOf
): VoxelInverse | null {
  switch (command.action) {
    case "world-replace":
      return { kind: "none" };
    case "added":
      return {
        kind: "remove",
        layerId: command.layerId
      };
    case "cloned":
      return {
        kind: "remove",
        layerId: command.metadata.cloneId
      };
    case "layer-moved":
    case "updated":
    case "position-updated": {
      const image = imageOfLayer(command.layerId);
      if (image === undefined) {
        return null;
      }
      if (command.action === "layer-moved") {
        return {
          kind: "rank",
          layerId: command.layerId,
          rank: image.rank
        };
      }
      if (command.action === "position-updated") {
        return {
          kind: "position",
          layerId: command.layerId,
          position: image.position
        };
      }

      return {
        kind: "options",
        layerId: command.layerId,
        options: previousOptions(
          command.metadata.options,
          image
        )
      };
    }
    default:
      return null;
  }
}

function previousOptions(
  options: VoxelLayerUpdate,
  image: LayerImage
): VoxelLayerUpdate {
  const previous: VoxelLayerUpdate = {};
  if (options.name !== undefined) {
    previous.name = image.name;
  }
  if (options.visible !== undefined) {
    previous.visible = image.visible;
  }
  if (options.compositing !== undefined) {
    previous.compositing = image.compositing;
  }
  if (options.properties !== undefined) {
    previous.properties = structuredClone(image.properties);
  }

  return previous;
}

function imageOf(
  layer: VoxelLayer
): LayerImage {
  return {
    name: layer.name,
    visible: layer.visible,
    compositing: layer.compositing,
    properties: structuredClone(layer.properties),
    rank: layer.rank,
    position: { ...layer.position }
  };
}

function imagesOf(
  document: VoxelDocument
): Map<string, LayerImage> {
  return new Map(
    document.world.getLayers().map(
      (layer) => [layer.id, imageOf(layer)]
    )
  );
}
