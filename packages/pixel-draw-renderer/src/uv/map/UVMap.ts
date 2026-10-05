// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type {
  RotationDirection,
  SelectionRect,
  Vec2
} from "../../types.ts";
import { CanvasBounds } from "./CanvasBounds.ts";
import {
  UVRegionFactory,
  type UVRegionCreateOptions
} from "./UVRegionFactory.ts";
import {
  UVRegion,
  type UVSlot,
  type UVRegionData,
  type UVResizeOptions,
  type UVRegionState
} from "../region/UVRegion.ts";
import type { UVMapEvent } from "./UVMap.events.ts";

export type {
  UVMapEvent,
  UVMapEventType,
  UVMapListener
} from "./UVMap.events.ts";
export type {
  UVRegionCreateOptions,
  UVSlotGeometryTemplate,
  UVSlotSize
} from "./UVRegionFactory.ts";

export interface UVMapOptions {
  getCanvasSize: () => Vec2;
}

export type UVLabelScope = "all" | "selected";

type UVRegionChange = (
  region: UVRegion,
  previous: UVRegionData
) => void;

export class UVMap extends Emitter<
  UVMapEvent
> implements Iterable<UVRegion> {
  #getCanvasSize: () => Vec2;
  #factory: UVRegionFactory;
  #regions = new Map<string, UVRegion>();
  #selectedRegionId: string | null = null;
  #selectedSlot: UVSlot | null = null;
  #showAll = false;
  #showRegionLabels = false;
  #showSizeLabels = false;
  #labelScope: UVLabelScope = "all";

  constructor(
    options: UVMapOptions
  ) {
    super();
    this.#getCanvasSize = options.getCanvasSize;
    this.#factory = new UVRegionFactory(options.getCanvasSize);
  }

  get regions(): IterableIterator<UVRegion> {
    return this.#regions.values();
  }

  [Symbol.iterator](): IterableIterator<UVRegion> {
    return this.#regions.values();
  }

  get selectedRegionId(): string | null {
    return this.#selectedRegionId;
  }

  get selectedSlot(): UVSlot | null {
    return this.#selectedSlot;
  }

  get showAll(): boolean {
    return this.#showAll;
  }

  set showAll(
    value: boolean
  ) {
    if (this.#showAll === value) {
      return;
    }

    this.#showAll = value;
    this.emit("visibility-changed", { showAll: value });
    this.emit("changed");
  }

  get showRegionLabels(): boolean {
    return this.#showRegionLabels;
  }

  set showRegionLabels(
    value: boolean
  ) {
    if (this.#showRegionLabels === value) {
      return;
    }

    this.#showRegionLabels = value;
    this.emit("label-visibility-changed", { showRegionLabels: value });
    this.emit("changed");
  }

  get showSizeLabels(): boolean {
    return this.#showSizeLabels;
  }

  set showSizeLabels(
    value: boolean
  ) {
    if (this.#showSizeLabels === value) {
      return;
    }

    this.#showSizeLabels = value;
    this.emit("size-label-visibility-changed", { showSizeLabels: value });
    this.emit("changed");
  }

  get labelScope(): UVLabelScope {
    return this.#labelScope;
  }

  set labelScope(
    value: UVLabelScope
  ) {
    if (this.#labelScope === value) {
      return;
    }

    this.#labelScope = value;
    this.emit("label-scope-changed", { labelScope: value });
    this.emit("changed");
  }

  get(
    id: string
  ): UVRegion | undefined {
    return this.#regions.get(id);
  }

  canvasSize(): Vec2 {
    return this.#getCanvasSize();
  }

  isVisible(
    id: string
  ): boolean {
    return this.#showAll || this.#selectedRegionId === id;
  }

  select(
    id: string | null,
    slot: UVSlot | null = null
  ): void {
    if (this.#applySelection(id, slot)) {
      this.#emitSelectionChanged();
      this.emit("changed");
    }
  }

  create(
    options: UVRegionCreateOptions
  ): UVRegion {
    const region = this.#factory.create(options);

    this.#regions.set(region.id, region);
    this.emit("region-created", { region });
    this.emit("changed");

    return region;
  }

  restore(
    value: UVRegion | UVRegionData
  ): UVRegion {
    const region = UVRegion.from(value);
    if (this.#regions.has(region.id)) {
      this.restoreState(region);

      return region;
    }

    this.#regions.set(region.id, region);
    this.emit("region-created", { region });
    this.emit("changed");

    return region;
  }

  delete(
    id: string
  ): boolean {
    return this.#deleteWhere((region) => region.id === id) > 0;
  }

  clear(
    filter: (region: UVRegion) => boolean = () => true
  ): void {
    this.#deleteWhere(filter);
    if (this.#regions.size === 0) {
      this.#factory.reset();
    }
  }

  move(
    id: string,
    rect: SelectionRect,
    slot: UVSlot | null = null
  ): boolean {
    const region = this.#regions.get(id);
    const target = region === undefined ? undefined : this.#movementTarget(region, slot);
    if (region === undefined || target === undefined) {
      return false;
    }

    const moved = this.#bounds().move(region, rect, target);
    this.#regions.set(id, moved);
    this.emit("region-moved", {
      region: moved,
      face: target,
      previousRect: region.rectFor(target)
    });
    this.emit("changed");

    return true;
  }

  previewMove(
    id: string,
    rect: SelectionRect,
    slot: UVSlot | null = null
  ): UVRegion | null {
    const region = this.#regions.get(id);
    const target = region === undefined ? undefined : this.#movementTarget(region, slot);
    if (region === undefined || target === undefined) {
      return null;
    }

    return this.#previewed(this.#bounds().move(region, rect, target), target);
  }

  resize(
    id: string,
    rect: SelectionRect,
    slot: UVSlot | null = null,
    options: UVResizeOptions = {}
  ): boolean {
    return this.#replace(
      id,
      (region) => this.#bounds().resize(region, rect, slot, options),
      this.#stateChanged
    );
  }

  previewResize(
    id: string,
    rect: SelectionRect,
    slot: UVSlot | null = null,
    options: UVResizeOptions = {}
  ): UVRegion | null {
    const region = this.#regions.get(id);
    if (!region) {
      return null;
    }

    return this.#previewed(this.#bounds().resize(region, rect, slot, options), slot);
  }

  endPreview(
    id: string,
    committed: boolean
  ): void {
    this.emit("region-drag-ended", { id, committed });
  }

  setState(
    id: string,
    state: UVRegionState,
    slot: UVSlot | null = null
  ): boolean {
    return this.#replace(
      id,
      (region) => this.#withState(region, state, slot),
      this.#stateChanged
    );
  }

  rename(
    id: string,
    name: string
  ): boolean {
    return this.#replace(
      id,
      (region) => region.renamed(name),
      this.#stateChanged
    );
  }

  restoreState(
    value: UVRegion | UVRegionData
  ): boolean {
    const next = UVRegion.from(value);

    return this.#replace(next.id, () => next, this.#stateChanged);
  }

  rotate(
    id: string,
    direction: RotationDirection,
    slot: UVSlot | null = null
  ): boolean {
    const region = this.#regions.get(id);
    const face = region === undefined ? undefined : this.#movementTarget(region, slot);
    if (face === undefined) {
      return false;
    }

    return this.#replace(
      id,
      (current) => this.#bounds().clampSlot(current.rotated(direction, face), face),
      this.#rotated(face)
    );
  }

  restoreRotation(
    value: UVRegion | UVRegionData,
    face: UVSlot | null = null
  ): boolean {
    const next = UVRegion.from(value);

    return this.#replace(next.id, () => next, this.#rotated(face));
  }

  #withState(
    region: UVRegion,
    state: UVRegionState,
    slot: UVSlot | null
  ): UVRegion {
    switch (state) {
      case "stacked":
        return region.stack(slot);
      case "unfolded":
        return this.#bounds().clamp(region.unfold());
      case "free":
        return region.free();
      default:
        return state satisfies never;
    }
  }

  #replace(
    id: string,
    transform: (region: UVRegion) => UVRegion,
    announce: UVRegionChange
  ): boolean {
    const region = this.#regions.get(id);
    if (!region) {
      return false;
    }

    const next = transform(region);
    if (next === region) {
      return false;
    }

    this.#regions.set(id, next);
    const selectionChanged = this.#applySelection(
      this.#selectedRegionId,
      this.#selectedSlot
    );
    announce(next, region.toJSON());
    if (selectionChanged) {
      this.#emitSelectionChanged();
    }
    this.emit("changed");

    return true;
  }

  readonly #stateChanged: UVRegionChange = (region, previous) => {
    this.emit("region-state-changed", { region, previous });
  };

  #rotated(
    face: UVSlot | null
  ): UVRegionChange {
    return (region, previous) => {
      this.emit("region-rotated", { region, previous, face });
    };
  }

  #deleteWhere(
    filter: (region: UVRegion) => boolean
  ): number {
    const removed = [...this.#regions.values()].filter(filter);
    for (const region of removed) {
      this.#regions.delete(region.id);
    }

    const selectionChanged = removed.some((region) => region.id === this.#selectedRegionId);
    if (selectionChanged) {
      this.#selectedRegionId = null;
      this.#selectedSlot = null;
    }
    for (const region of removed) {
      this.emit("region-deleted", { region });
    }
    if (selectionChanged) {
      this.#emitSelectionChanged();
    }
    if (removed.length > 0) {
      this.emit("changed");
    }

    return removed.length;
  }

  #movementTarget(
    region: UVRegion,
    slot: UVSlot | null
  ): UVSlot | null | undefined {
    if (region.movementScope === "region") {
      return null;
    }

    return region.isTarget(slot) ? slot : undefined;
  }

  #bounds(): CanvasBounds {
    return new CanvasBounds(this.#getCanvasSize());
  }

  #applySelection(
    id: string | null,
    slot: UVSlot | null
  ): boolean {
    if (id === null) {
      const changed = this.#selectedRegionId !== null || this.#selectedSlot !== null;
      this.#selectedRegionId = null;
      this.#selectedSlot = null;

      return changed;
    }

    const region = this.#regions.get(id);
    if (!region) {
      return false;
    }

    let nextSlot: UVSlot | null = null;
    if (region.movementScope === "slot") {
      nextSlot = region.isTarget(slot) ? slot : region.activeSlots[0];
    }
    const changed = this.#selectedRegionId !== id || this.#selectedSlot !== nextSlot;
    this.#selectedRegionId = id;
    this.#selectedSlot = nextSlot;

    return changed;
  }

  #emitSelectionChanged(): void {
    this.emit("selection-changed", {
      selectedRegionId: this.#selectedRegionId,
      selectedSlot: this.#selectedSlot
    });
  }

  #previewed(
    region: UVRegion,
    slot: UVSlot | null
  ): UVRegion {
    this.emit("region-dragging", {
      region,
      face: region.movementScope === "slot" ? slot : null
    });

    return region;
  }
}
