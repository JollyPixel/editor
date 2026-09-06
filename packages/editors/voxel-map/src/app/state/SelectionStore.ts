// Import Internal Dependencies
import type { ObjectKey } from "../../features/layers/objects/objectArea.ts";
import { EditorStore } from "./EditorStore.ts";

export type LayerSelection =
  | { kind: "voxel-layer"; name: string; }
  | { kind: "object-layer"; name: string; }
  | { kind: "object"; layerName: string; objectId: string; }
  | null;

export type SelectionStoreEvents = {
  change: (
    selection: LayerSelection
  ) => void;
  gizmoLayerChange: (
    name: string | null
  ) => void;
  gizmoDraggingChange: (
    dragging: boolean
  ) => void;
};

export class SelectionStore extends EditorStore<SelectionStoreEvents> {
  #current: LayerSelection = null;
  #gizmoLayer: string | null = null;
  #gizmoDragging = false;

  get current(): LayerSelection {
    return this.#current;
  }

  set current(
    selection: LayerSelection
  ) {
    if (selectionKey(this.#current) === selectionKey(selection)) {
      return;
    }

    this.#current = selection;
    this.emit(
      "change",
      selection
    );

    this.gizmoLayer = null;
  }

  get voxelLayer(): string | null {
    return this.#current?.kind === "voxel-layer"
      ? this.#current.name
      : null;
  }

  get objectLayer(): string | null {
    const selection = this.#current;
    if (selection === null) {
      return null;
    }

    switch (selection.kind) {
      case "object-layer":
        return selection.name;
      case "object":
        return selection.layerName;
      default:
        return null;
    }
  }

  get isObjectContext(): boolean {
    return this.objectLayer !== null;
  }

  get object(): ObjectKey | null {
    return this.#current?.kind === "object"
      ? {
        layerName: this.#current.layerName,
        objectId: this.#current.objectId
      }
      : null;
  }

  get gizmoLayer(): string | null {
    return this.#gizmoLayer;
  }

  set gizmoLayer(
    name: string | null
  ) {
    if (this.#gizmoLayer === name) {
      return;
    }

    this.#gizmoLayer = name;
    this.emit(
      "gizmoLayerChange",
      name
    );
  }

  get gizmoDragging(): boolean {
    return this.#gizmoDragging;
  }

  set gizmoDragging(
    dragging: boolean
  ) {
    if (this.#gizmoDragging === dragging) {
      return;
    }
    this.#gizmoDragging = dragging;
    this.emit(
      "gizmoDraggingChange",
      dragging
    );
  }

  selectVoxelLayer(
    name: string | null
  ): void {
    this.current = name === null
      ? null
      : { kind: "voxel-layer", name };
  }

  selectObjectLayer(
    name: string
  ): void {
    this.current = {
      kind: "object-layer",
      name
    };
  }

  selectObject(
    key: ObjectKey
  ): void {
    this.current = {
      kind: "object",
      layerName: key.layerName,
      objectId: key.objectId
    };
  }

  clear(): void {
    this.current = null;
  }
}

function selectionKey(
  selection: LayerSelection
): string | null {
  if (selection === null) {
    return null;
  }

  return selection.kind === "object"
    ? `${selection.kind}:${selection.layerName}/${selection.objectId}`
    : `${selection.kind}:${selection.name}`;
}
