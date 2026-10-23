// Import Internal Dependencies
import type { LayerRef } from "../../state/index.ts";
import type { VoxelMapEditing } from "../../editing/VoxelMapEditing.ts";
import { collectLayerSelections } from "./layerTree.ts";

export type LayerCommand =
  | "frame"
  | "rename"
  | "duplicate"
  | "save-template"
  | "add-object"
  | "lock"
  | "unlock"
  | "show-only"
  | "show-all"
  | "delete";

export type LayerRootCommand = "add-layer" | "show-all";

export type LayerCommandsEditing = Pick<
  VoxelMapEditing,
  | "state"
  | "editorMap"
  | "layers"
  | "layerVisibility"
  | "templates"
  | "frame"
>;

export interface LayerCommandsOptions {
  editing: LayerCommandsEditing;
  rename(ref: LayerRef): void;
  addLayer(): Promise<void>;
}

type RowCommands = {
  [TCommand in LayerCommand]: (ref: LayerRef) => Promise<void> | void;
};

type RootCommands = {
  [TCommand in LayerRootCommand]: () => Promise<void> | void;
};

export class LayerCommands {
  readonly #editing: LayerCommandsEditing;
  readonly #rename: (ref: LayerRef) => void;
  readonly #addLayer: () => Promise<void>;

  readonly #row: RowCommands = {
    frame: (ref) => {
      const bounds = this.#editing.layers.bounds(ref);
      if (bounds !== null) {
        this.#editing.frame(bounds);
      }
    },
    rename: (ref) => this.#rename(ref),
    duplicate: (ref) => this.#editing.layers.clone(ref),
    "save-template": (ref) => {
      if (ref.kind === "voxel-layer") {
        this.#editing.templates.saveLayer(ref.name);
      }
    },
    "add-object": (ref) => {
      this.#editing.state.selection.current = ref;

      return this.#addLayer();
    },
    lock: (ref) => this.#editing.layers.lock(ref, true),
    unlock: (ref) => this.#editing.layers.lock(ref, false),
    "show-only": (ref) => this.#editing.layerVisibility.showOnly(
      ref,
      this.#entries()
    ),
    "show-all": () => this.#showAll(),
    delete: (ref) => this.#editing.layers.remove(ref)
  };

  readonly #root: RootCommands = {
    "add-layer": () => this.#addLayer(),
    "show-all": () => this.#showAll()
  };

  constructor(
    options: LayerCommandsOptions
  ) {
    this.#editing = options.editing;
    this.#rename = options.rename;
    this.#addLayer = options.addLayer;
  }

  run(
    ref: LayerRef,
    command: LayerCommand
  ): Promise<void> | void {
    return this.#row[command](ref);
  }

  runRoot(
    command: LayerRootCommand
  ): Promise<void> | void {
    return this.#root[command]();
  }

  mergeInto(
    ref: LayerRef,
    target: string
  ): Promise<void> {
    return this.#editing.layers.mergeInto(ref, target);
  }

  moveTo(
    ref: LayerRef,
    objectLayer: string
  ): void {
    this.#editing.layers.moveTo(ref, objectLayer);
  }

  #showAll(): void {
    this.#editing.layerVisibility.showAll(this.#entries());
  }

  #entries(): Iterable<LayerRef> {
    return collectLayerSelections(this.#editing.editorMap.world);
  }
}
