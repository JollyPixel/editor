// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

export interface ObjectKey {
  layerName: string;
  objectId: string;
}

export type LayerSelection =
  | { kind: "voxel-layer"; name: string; }
  | { kind: "object-layer"; name: string; }
  | { kind: "object"; layerName: string; objectId: string; };

export type SelectionStoreEvents = {
  change: (
    selection: LayerSelection | null
  ) => void;
  gizmoLayerChange: (
    name: string | null
  ) => void;
  gizmoDraggingChange: (
    dragging: boolean
  ) => void;
};

export class SelectionStore extends Emitter<SelectionStoreEvents> {
  #current: LayerSelection | null = null;
  #entries: readonly LayerSelection[] = [];
  #lastVoxelLayer: string | null = null;
  #gizmoLayer: string | null = null;
  #gizmoDragging = false;

  get current(): LayerSelection | null {
    return this.#current;
  }

  set current(
    selection: LayerSelection
  ) {
    this.#assign(selection);
  }

  get voxelLayer(): string | null {
    return this.#current?.kind === "voxel-layer"
      ? this.#current.name
      : null;
  }

  get lastVoxelLayer(): string | null {
    const names = this.#entries.flatMap(
      (entry) => (entry.kind === "voxel-layer" ? [entry.name] : [])
    );

    return this.#lastVoxelLayer !== null && names.includes(this.#lastVoxelLayer)
      ? this.#lastVoxelLayer
      : names[0] ?? null;
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
    name: string
  ): void {
    this.current = {
      kind: "voxel-layer",
      name
    };
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

  reconcile(
    entries: readonly LayerSelection[]
  ): void {
    const previous = this.#entries;
    this.#entries = [...entries];

    this.#assign(
      fallbackSelection(this.#current, previous, this.#entries)
    );
  }

  #assign(
    selection: LayerSelection | null
  ): void {
    if (selectionKey(this.#current) === selectionKey(selection)) {
      return;
    }

    this.#current = selection;
    if (selection?.kind === "voxel-layer") {
      this.#lastVoxelLayer = selection.name;
    }
    this.emit(
      "change",
      selection
    );

    this.gizmoLayer = null;
  }
}

function fallbackSelection(
  current: LayerSelection | null,
  previous: readonly LayerSelection[],
  next: readonly LayerSelection[]
): LayerSelection | null {
  if (current === null) {
    return firstLayerOf(next);
  }

  const key = selectionKey(current);
  if (next.some((entry) => selectionKey(entry) === key)) {
    return current;
  }

  if (current.kind === "object") {
    return fallbackSelection(
      {
        kind: "object-layer",
        name: current.layerName
      },
      previous,
      next
    );
  }

  const before = previous.filter((entry) => entry.kind === current.kind);
  const after = next.filter((entry) => entry.kind === current.kind);
  const index = before.findIndex((entry) => selectionKey(entry) === key);
  if (index !== -1 && after.length > 0) {
    return after[Math.min(index, after.length - 1)];
  }

  return firstLayerOf(next);
}

function firstLayerOf(
  entries: readonly LayerSelection[]
): LayerSelection | null {
  return entries.find((entry) => entry.kind === "voxel-layer") ??
    entries.find((entry) => entry.kind === "object-layer") ??
    null;
}

function selectionKey(
  selection: LayerSelection | null
): string | null {
  if (selection === null) {
    return null;
  }

  return selection.kind === "object"
    ? `${selection.kind}:${selection.layerName}/${selection.objectId}`
    : `${selection.kind}:${selection.name}`;
}
