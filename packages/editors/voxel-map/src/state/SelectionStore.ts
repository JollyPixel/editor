// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { LayerRef } from "./LayerRef.ts";
import { ObjectLayerRef } from "./ObjectLayerRef.ts";
import type { ObjectRef } from "./ObjectRef.ts";
import { VoxelLayerRef } from "./VoxelLayerRef.ts";

export type SelectionStoreEvents = {
  change: (
    selection: LayerRef | null
  ) => void;
};

export class SelectionStore extends Emitter<SelectionStoreEvents> {
  #current: LayerRef | null = null;
  #entries: readonly LayerRef[] = [];
  #lastVoxelLayer: string | null = null;

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
    return this.#current?.objectLayer ?? null;
  }

  get isObjectContext(): boolean {
    return this.objectLayer !== null;
  }

  get object(): ObjectRef | null {
    return this.#current?.kind === "object" ? this.#current : null;
  }

  selectVoxelLayer(
    name: string
  ): void {
    this.current = new VoxelLayerRef(name);
  }

  selectObjectLayer(
    name: string
  ): void {
    this.current = new ObjectLayerRef(name);
  }

  selectObject(
    ref: ObjectRef
  ): void {
    this.current = ref;
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
    if (this.#current?.key === selection?.key) {
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

  if (next.some((entry) => current.equals(entry))) {
    return current;
  }

  if (current.kind === "object") {
    const moved = next.find(
      (entry) => entry.kind === "object" && entry.objectId === current.objectId
    );
    if (moved !== undefined) {
      return moved;
    }

    return fallbackSelection(current.layer, previous, next);
  }

  const before = previous.filter((entry) => entry.kind === current.kind);
  const after = next.filter((entry) => entry.kind === current.kind);
  const index = before.findIndex((entry) => current.equals(entry));
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
