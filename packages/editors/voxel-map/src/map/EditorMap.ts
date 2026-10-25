// Import Third-party Dependencies
import {
  isVoxelLayerCommand,
  isVoxelMaterialGroupCommand,
  isVoxelTemplateCommand,
  type BlockRedefinition,
  type VoxelCommand,
  type VoxelCommandContext,
  type VoxelLayer,
  type VoxelLayerCommand,
  type VoxelWorld,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";
import type {
  SyncedVoxelMap
} from "@jolly-pixel/asset.voxel-map/client";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { MapAccessSource } from "../access/MapAccess.ts";
import { TemplateDraftId } from "./TemplateDraftId.ts";

export type BlockRegistryChange =
  | "added"
  | "redefined"
  | "retiled"
  | "removed"
  | "moved"
  | "reset";

// CONSTANTS
const kMaxListenersPerEvent = 32;
const kRedefinitionChanges = {
  added: "added",
  metadata: "redefined",
  tiles: "retiled",
  mesh: "redefined",
  occlusion: "redefined"
} as const satisfies Record<BlockRedefinition, BlockRegistryChange>;

export type EditorMapEvents = {
  layerUpdated: (
    command: VoxelLayerCommand
  ) => void;
  blockRegistryChanged: (
    change: BlockRegistryChange
  ) => void;
  materialGroupsChanged: () => void;
  templatesChanged: () => void;
  reset: () => void;
};

export type EditorMapSignals = Pick<
  Emitter<EditorMapEvents>,
  "subscribe"
>;

export type SyncedMap = Pick<
  SyncedVoxelMap,
  "voxels" | "loaded" | "replaceWorld"
>;

export interface EditorMapOptions {
  map: SyncedMap;
  defaultLayerName: string;
  access: MapAccessSource;
}

export class EditorMap extends Emitter<EditorMapEvents> {
  static layers(
    world: Pick<VoxelWorld, "getLayers">
  ): VoxelLayer[] {
    return world.getLayers().filter((layer) => !TemplateDraftId.isDraft(layer));
  }

  #map: SyncedMap;
  #defaultLayerName: string;
  readonly #access: MapAccessSource;

  #onCommand = (
    command: VoxelCommand,
    context: VoxelCommandContext
  ): void => {
    if (isVoxelLayerCommand(command)) {
      this.emit("layerUpdated", command);
    }
    else if (command.action === "block-defined") {
      this.emit(
        "blockRegistryChanged",
        kRedefinitionChanges[context.redefinition ?? "added"]
      );
    }
    else if (command.action === "block-removed") {
      this.emit("blockRegistryChanged", "removed");
    }
    else if (command.action === "block-moved") {
      this.emit("blockRegistryChanged", "moved");
    }
    else if (isVoxelMaterialGroupCommand(command)) {
      this.emit("materialGroupsChanged");
    }
    else if (isVoxelTemplateCommand(command)) {
      this.emit("templatesChanged");
    }
  };

  #onLoaded = (): void => {
    this.#seedDefaultLayer();
    this.emit("blockRegistryChanged", "reset");
    this.emit("materialGroupsChanged");
    this.emit("templatesChanged");
    this.emit("reset");
  };

  get ready(): boolean {
    return this.#map.loaded;
  }

  get world(): VoxelWorld {
    return this.#map.voxels.world;
  }

  get blocks(): SyncedMap["voxels"]["blocks"] {
    return this.#map.voxels.blocks;
  }

  get materialGroups(): SyncedMap["voxels"]["materialGroups"] {
    return this.#map.voxels.materialGroups;
  }

  constructor(
    options: EditorMapOptions
  ) {
    super();
    this.setMaxListeners(kMaxListenersPerEvent);
    this.#map = options.map;
    this.#defaultLayerName = options.defaultLayerName;
    this.#access = options.access;

    this.#map.voxels.on("command", this.#onCommand);
    this.#map.voxels.on("loaded", this.#onLoaded);
    if (this.ready) {
      this.#seedDefaultLayer();
    }
  }

  load(
    data: VoxelWorldJSON
  ): void {
    this.#map.replaceWorld(data);
  }

  dispose(): void {
    this.#map.voxels.off("command", this.#onCommand);
    this.#map.voxels.off("loaded", this.#onLoaded);
  }

  #seedDefaultLayer(): void {
    if (
      this.#access.current.has("layers") &&
      EditorMap.layers(this.world).length === 0
    ) {
      this.world.addLayer(this.#defaultLayerName);
    }
  }
}
