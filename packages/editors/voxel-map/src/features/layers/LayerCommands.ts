// Import Internal Dependencies
import type { LayerRef } from "../../state/index.ts";
import type { VoxelMapWorkspace } from "../../workspace/VoxelMapWorkspace.ts";
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

export type LayerCommandsWorkspace = Pick<
  VoxelMapWorkspace,
  | "state"
  | "editorMap"
  | "layers"
  | "layerVisibility"
  | "templates"
  | "frame"
>;

export interface LayerCommandsOptions {
  workspace: LayerCommandsWorkspace;
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
  readonly #workspace: LayerCommandsWorkspace;
  readonly #rename: (ref: LayerRef) => void;
  readonly #addLayer: () => Promise<void>;

  readonly #row: RowCommands = {
    frame: (ref) => {
      const bounds = this.#workspace.layers.bounds(ref);
      if (bounds !== null) {
        this.#workspace.frame(bounds);
      }
    },
    rename: (ref) => this.#rename(ref),
    duplicate: (ref) => this.#workspace.layers.clone(ref),
    "save-template": (ref) => {
      if (ref.kind === "voxel-layer") {
        this.#workspace.templates.saveLayer(ref.name);
      }
    },
    "add-object": (ref) => {
      this.#workspace.state.selection.current = ref;

      return this.#addLayer();
    },
    lock: (ref) => this.#workspace.layers.lock(ref, true),
    unlock: (ref) => this.#workspace.layers.lock(ref, false),
    "show-only": (ref) => this.#workspace.layerVisibility.showOnly(
      ref,
      this.#entries()
    ),
    "show-all": () => this.#showAll(),
    delete: (ref) => this.#workspace.layers.remove(ref)
  };

  readonly #root: RootCommands = {
    "add-layer": () => this.#addLayer(),
    "show-all": () => this.#showAll()
  };

  constructor(
    options: LayerCommandsOptions
  ) {
    this.#workspace = options.workspace;
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
    return this.#workspace.layers.mergeInto(ref, target);
  }

  moveTo(
    ref: LayerRef,
    objectLayer: string
  ): void {
    this.#workspace.layers.moveTo(ref, objectLayer);
  }

  #showAll(): void {
    this.#workspace.layerVisibility.showAll(this.#entries());
  }

  #entries(): Iterable<LayerRef> {
    return collectLayerSelections(this.#workspace.editorMap.world);
  }
}
