// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  layerKey,
  type LayerRef,
  type ObjectRef
} from "./layerRef.ts";

export type SelectionStoreEvents = {
  change: (
    selection: LayerRef | null
  ) => void;
  gizmoLayerChange: (
    name: string | null
  ) => void;
};

export class SelectionStore extends Emitter<SelectionStoreEvents> {
  #current: LayerRef | null = null;
  #entries: readonly LayerRef[] = [];
  #lastVoxelLayer: string | null = null;
  #gizmoLayer: string | null = null;

  get current(): LayerRef | null {
    return this.#current;
  }

  set current(
    selection: LayerRef
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

  get object(): ObjectRef | null {
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
    key: ObjectRef
  ): void {
    this.current = {
      kind: "object",
      layerName: key.layerName,
      objectId: key.objectId
    };
  }

  reconcile(
    entries: readonly LayerRef[]
  ): void {
    const previous = this.#entries;
    this.#entries = [...entries];

    this.#assign(
      fallbackSelection(this.#current, previous, this.#entries)
    );
  }

  #assign(
    selection: LayerRef | null
  ): void {
    if (keyOf(this.#current) === keyOf(selection)) {
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
  current: LayerRef | null,
  previous: readonly LayerRef[],
  next: readonly LayerRef[]
): LayerRef | null {
  if (current === null) {
    return firstLayerOf(next);
  }

  const key = keyOf(current);
  if (next.some((entry) => keyOf(entry) === key)) {
    return current;
  }

  if (current.kind === "object") {
    const moved = next.find(
      (entry) => entry.kind === "object" && entry.objectId === current.objectId
    );
    if (moved !== undefined) {
      return moved;
    }

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
  const index = before.findIndex((entry) => keyOf(entry) === key);
  if (index !== -1 && after.length > 0) {
    return after[Math.min(index, after.length - 1)];
  }

  return firstLayerOf(next);
}

function firstLayerOf(
  entries: readonly LayerRef[]
): LayerRef | null {
  return entries.find((entry) => entry.kind === "voxel-layer") ??
    entries.find((entry) => entry.kind === "object-layer") ??
    null;
}

function keyOf(
  selection: LayerRef | null
): string | null {
  return selection === null ? null : layerKey(selection);
}
