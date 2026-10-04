// Import Internal Dependencies
import { isRectGeometry } from "../../geometry/geometry.ts";
import type { UVSlotMap } from "../UVSlotMap.ts";
import type { UVLayoutResizeTarget } from "./UVResizeTarget.ts";
import type {
  UVGeometry,
  UVRect,
  UVRegionState,
  UVSlot
} from "../../geometry/types.ts";
import type {
  SelectionRect,
  Vec2
} from "../../../types.ts";

export type UVMovementScope = "region" | "slot";

export interface UVResizeOptions {
  aligned?: boolean;
}

export interface UVRegionSlot {
  slot: UVSlot | null;
  geometry: UVGeometry;
}

export type UVLayoutData =
  | {
    state: "stacked";
    rect: UVRect;
    faces?: Record<UVSlot, UVGeometry>;
    activeFaces?: UVSlot[];
    stackedFace?: UVSlot;
  }
  | {
    state: "unfolded" | "free";
    faces: Record<UVSlot, UVGeometry>;
    activeFaces?: UVSlot[];
  };

export abstract class UVLayout {
  readonly faces: UVSlotMap;
  readonly activeSlots: readonly UVSlot[];

  abstract readonly state: UVRegionState;
  abstract readonly movementScope: UVMovementScope;

  constructor(
    faces: UVSlotMap,
    activeSlots: readonly UVSlot[]
  ) {
    const known = [...new Set(activeSlots)].filter((slot) => faces.has(slot));
    if (known.length === 0) {
      throw new RangeError("A UV region needs at least one active slot it has geometry for");
    }

    this.faces = faces;
    this.activeSlots = Object.freeze(known);
  }

  get resizable(): boolean {
    return this.faces.slots.every(
      (slot) => isRectGeometry(this.faces.get(slot))
    );
  }

  get stackedFace(): UVSlot | null {
    return null;
  }

  isTarget(
    slot: UVSlot | null
  ): slot is UVSlot {
    return slot !== null && this.activeSlots.includes(slot);
  }

  withGeometry(
    _slot: UVSlot,
    _geometry: UVGeometry
  ): UVLayout {
    return this;
  }

  abstract get bounds(): SelectionRect;

  abstract rectFor(
    slot: UVSlot | null
  ): SelectionRect;

  abstract geometryFor(
    slot: UVSlot
  ): UVGeometry;

  abstract slotsOf(): UVRegionSlot[];

  abstract spreadFaces(): UVSlotMap;

  abstract translated(
    delta: Vec2
  ): UVLayout;

  abstract movedTo(
    position: Vec2,
    slot: UVSlot | null
  ): UVLayout;

  abstract resized(
    rect: SelectionRect,
    slot: UVSlot | null,
    options: UVResizeOptions
  ): UVLayout;

  abstract rotated(
    turns: number,
    slot: UVSlot | null
  ): UVLayout;

  abstract resizeTargets(
    selectedSlot: UVSlot | null
  ): UVLayoutResizeTarget[];

  abstract toJSON(): UVLayoutData;
}
