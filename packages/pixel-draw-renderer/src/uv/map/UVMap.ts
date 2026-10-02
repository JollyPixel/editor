// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type {
  RotationDirection,
  SelectionRect,
  Vec2
} from "../../types.ts";
import {
  clampRegion,
  clampRotatedRegion,
  moveRegion,
  resizeRegion
} from "./canvasBounds.ts";
import { UVRegionCollection } from "../region/UVRegionCollection.ts";
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

// CONSTANTS
const kDefaultSlot: UVSlot = "front";

export class UVMap extends Emitter<
  UVMapEvent
> implements Iterable<UVRegion> {
  #getCanvasSize: () => Vec2;
  #factory: UVRegionFactory;
  #regions = new UVRegionCollection();
  #selectedRegionId: string | null = null;
  #selectedSlot: UVSlot | null = null;
  #showAll = false;
  #showRegionLabels = false;
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
    slot?: UVSlot
  ): void {
    if (this.#applySelection(id, slot ?? null)) {
      this.#emitSelectionChanged();
      this.emit("changed");
    }
  }

  create(
    options: UVRegionCreateOptions
  ): UVRegion {
    const region = this.#factory.create(options);

    this.#regions.set(region);
    this.emit("region-created", {
      region
    });
    this.emit("changed");

    return region;
  }

  restore(
    region: UVRegion | UVRegionData
  ): UVRegion {
    const stored = UVRegion.from(region);
    if (this.#regions.has(stored.id)) {
      this.restoreState(stored);

      return this.#regions.get(stored.id) ?? stored;
    }

    this.#regions.set(stored);

    this.emit("region-created", {
      region: stored
    });
    this.emit("changed");

    return stored;
  }

  delete(
    id: string
  ): boolean {
    const region = this.#regions.get(id);
    if (!region) {
      return false;
    }

    this.#regions.delete(id);
    const selectionChanged = this.#selectedRegionId === id;
    if (selectionChanged) {
      this.#selectedRegionId = null;
      this.#selectedSlot = null;
    }
    this.emit(
      "region-deleted",
      { region }
    );
    if (selectionChanged) {
      this.#emitSelectionChanged();
    }
    this.emit("changed");

    return true;
  }

  move(
    id: string,
    rect: SelectionRect,
    slot?: UVSlot
  ): boolean {
    const region = this.#regions.get(id);
    if (!region) {
      return false;
    }

    const target = this.#resolveSlot(region, slot);
    if (target === undefined) {
      return false;
    }

    const previousRect = region.rectFor(
      target ?? kDefaultSlot
    );
    const moved = moveRegion(region, rect, target, this.#getCanvasSize());
    this.#regions.set(moved);

    this.emit("region-moved", {
      region: moved,
      face: target,
      previousRect
    });
    this.emit("changed");

    return true;
  }

  previewMove(
    id: string,
    rect: SelectionRect,
    slot?: UVSlot
  ): UVRegion | null {
    const region = this.#regions.get(id);
    if (!region) {
      return null;
    }

    const target = this.#resolveSlot(
      region,
      slot
    );
    if (target === undefined) {
      return null;
    }

    return this.#previewed(
      moveRegion(region, rect, target, this.#getCanvasSize()),
      target
    );
  }

  resize(
    id: string,
    rect: SelectionRect,
    slot?: UVSlot,
    options: UVResizeOptions = {}
  ): boolean {
    return this.#replace(
      id,
      (region) => resizeRegion(
        region,
        rect,
        slot,
        options,
        this.#getCanvasSize()
      )
    );
  }

  previewResize(
    id: string,
    rect: SelectionRect,
    slot?: UVSlot,
    options: UVResizeOptions = {}
  ): UVRegion | null {
    const region = this.#regions.get(id);
    if (!region) {
      return null;
    }

    return this.#previewed(
      resizeRegion(region, rect, slot, options, this.#getCanvasSize()),
      slot ?? null
    );
  }

  setState(
    id: string,
    state: UVRegionState,
    slot?: UVSlot
  ): boolean {
    return this.#replace(
      id,
      (region) => {
        switch (state) {
          case "stacked":
            return region.stack(slot);
          case "unfolded":
            return clampRegion(region.unfold(), this.#getCanvasSize());
          default:
            return region.free();
        }
      }
    );
  }

  rename(
    id: string,
    name: string
  ): boolean {
    return this.#replace(
      id,
      (region) => region.renamed(name)
    );
  }

  restoreState(
    value: UVRegion | UVRegionData
  ): boolean {
    const next = UVRegion.from(value);

    return this.#replace(
      next.id,
      () => next
    );
  }

  rotate(
    id: string,
    direction: RotationDirection,
    slot?: UVSlot
  ): boolean {
    const region = this.#regions.get(id);
    if (!region) {
      return false;
    }

    const face = region.movementScope === "slot" ? slot ?? null : null;
    if (region.movementScope === "slot" && face === null) {
      return false;
    }

    return this.#replace(
      id,
      (current) => clampRotatedRegion(
        current.rotated(direction, face ?? undefined),
        face,
        this.#getCanvasSize()
      ),
      face
    );
  }

  restoreRotation(
    value: UVRegion | UVRegionData,
    face: UVSlot | null = null
  ): boolean {
    const next = UVRegion.from(value);

    return this.#replace(
      next.id,
      () => next,
      face
    );
  }

  clear(
    filter: (region: UVRegion) => boolean = () => true
  ): void {
    for (const region of [...this.#regions.values()]) {
      if (filter(region)) {
        this.delete(region.id);
      }
    }
    if (this.#regions.size === 0) {
      this.#factory.reset();
    }
  }

  #replace(
    id: string,
    transform: (region: UVRegion) => UVRegion,
    rotatedFace?: UVSlot | null
  ): boolean {
    const region = this.#regions.get(id);
    if (!region) {
      return false;
    }

    const next = transform(region);
    if (next === region) {
      return false;
    }

    const previous = region.toJSON();
    this.#regions.set(next);

    const selectionChanged = this.#applySelection(
      this.#selectedRegionId,
      this.#selectedSlot
    );

    if (rotatedFace === undefined) {
      this.emit("region-state-changed", {
        region: next,
        previous
      });
    }
    else {
      this.emit("region-rotated", {
        region: next,
        previous,
        face: rotatedFace
      });
    }
    if (selectionChanged) {
      this.#emitSelectionChanged();
    }
    this.emit("changed");

    return true;
  }

  #resolveSlot(
    region: UVRegion,
    slot: UVSlot | undefined
  ): UVSlot | null | undefined {
    if (region.movementScope === "region") {
      return null;
    }

    return slot !== undefined && region.slots.includes(slot) ?
      slot :
      undefined;
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

    const activeSlots = region.slotsOf()
      .map(({ slot }) => slot)
      .filter((slot) => slot !== null);
    let nextSlot: UVSlot | null = null;
    if (region.movementScope === "slot") {
      const firstActiveSlot = activeSlots[0] ?? null;
      nextSlot = slot !== null && activeSlots.includes(slot) ? slot : firstActiveSlot;
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
