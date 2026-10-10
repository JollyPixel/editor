// Import Internal Dependencies
import type {
  RotationDirection,
  SelectionRect,
  Vec2
} from "../../types.ts";
import { quarterTurnsOf } from "../geometry/geometry.ts";
import { UVSlotMap } from "./UVSlotMap.ts";
import type {
  UVLayout,
  UVLayoutData,
  UVMovementScope,
  UVRegionSlot,
  UVResizeOptions
} from "./layout/UVLayout.ts";
import { StackedLayout } from "./layout/StackedLayout.ts";
import { NetLayout } from "./layout/NetLayout.ts";
import { FreeLayout } from "./layout/FreeLayout.ts";
import { UVNet } from "./UVNet.ts";
import type { UVResizeTarget } from "./layout/UVResizeTarget.ts";
import type {
  UVSlot,
  UVGeometry,
  UVRegionState
} from "../geometry/types.ts";

export type {
  UVQuarterTurn,
  UVRect,
  UVRegionState,
  UVTriangleCorner,
  UVTriangle,
  UVCompound,
  UVCompoundPart,
  UVNormalizedRect,
  UVSlot,
  UVGeometry
} from "../geometry/types.ts";
export type {
  UVLayoutData,
  UVMovementScope,
  UVRegionSlot,
  UVResizeOptions
} from "./layout/UVLayout.ts";
export { DEFAULT_UV_SLOTS } from "../geometry/types.ts";
export {
  UVNet,
  type UVNetRow
} from "./UVNet.ts";

export interface UVRegionIdentity {
  id: string;
  name?: string;
  color: string;
}

export type UVRegionData = UVRegionIdentity & UVLayoutData;

export class UVRegion {
  readonly id: string;
  readonly name?: string;
  readonly color: string;
  #layout: UVLayout;

  static from(
    value: UVRegion | UVRegionData
  ): UVRegion {
    return value instanceof UVRegion ? value : new UVRegion(value);
  }

  static fromLayout(
    layout: UVLayoutData,
    identity: UVRegionIdentity
  ): UVRegion {
    return new UVRegion({
      ...layout,
      ...identity
    });
  }

  constructor(
    data: UVRegionData
  ) {
    this.id = data.id;
    this.name = data.name;
    this.color = data.color;
    this.#layout = UVRegion.#layoutOf(data);
  }

  get slots(): readonly UVSlot[] {
    return this.#layout.faces.slots;
  }

  get activeSlots(): readonly UVSlot[] {
    return this.#layout.activeSlots;
  }

  get movementScope(): UVMovementScope {
    return this.#layout.movementScope;
  }

  get state(): UVRegionState {
    return this.#layout.state;
  }

  get resizable(): boolean {
    return this.#layout.resizable;
  }

  get stackedFace(): UVSlot | null {
    return this.#layout.stackedFace;
  }

  get bounds(): SelectionRect {
    return this.#layout.bounds;
  }

  isTarget(
    slot: UVSlot | null
  ): slot is UVSlot {
    return this.#layout.isTarget(slot);
  }

  rectFor(
    slot: UVSlot | null = null
  ): SelectionRect {
    return this.#layout.rectFor(slot);
  }

  geometryFor(
    slot: UVSlot
  ): UVGeometry {
    return this.#layout.geometryFor(slot);
  }

  slotsOf(): UVRegionSlot[] {
    return this.#layout.slotsOf();
  }

  resizeTargets(
    selectedSlot: UVSlot | null
  ): UVResizeTarget[] {
    if (!this.resizable) {
      return [];
    }

    return this.#layout.resizeTargets(selectedSlot).map((target) => {
      return {
        id: this.id,
        ...target
      };
    });
  }

  stack(
    slot: UVSlot | null = null
  ): UVRegion {
    return this.state === "stacked" ?
      this :
      this.#with(StackedLayout.stacking(this.#layout, slot));
  }

  unfold(
    net: UVNet = UVNet.packed
  ): UVRegion {
    return this.state === "unfolded" ?
      this :
      this.#with(NetLayout.unfolding(this.#layout, net));
  }

  free(): UVRegion {
    return this.state === "free" ?
      this :
      this.#with(FreeLayout.freeing(this.#layout));
  }

  renamed(
    name: string
  ): UVRegion {
    if (this.name === name) {
      return this;
    }

    return new UVRegion({
      ...this.toJSON(),
      name
    });
  }

  movedTo(
    position: Vec2,
    slot: UVSlot | null = null
  ): UVRegion {
    return this.#with(this.#layout.movedTo(position, slot));
  }

  translated(
    delta: Vec2
  ): UVRegion {
    return this.#with(this.#layout.translated(delta));
  }

  resized(
    rect: SelectionRect,
    slot: UVSlot | null = null,
    options: UVResizeOptions = {}
  ): UVRegion {
    if (rect.width < 1 || rect.height < 1) {
      throw new RangeError("UV resize needs a size of at least 1px");
    }
    if (!this.resizable) {
      return this;
    }

    return this.#with(this.#layout.resized(rect, slot, options));
  }

  withGeometry(
    slot: UVSlot,
    geometry: UVGeometry
  ): UVRegion {
    return this.#with(this.#layout.withGeometry(slot, geometry));
  }

  rotated(
    direction: RotationDirection,
    slot: UVSlot | null = null
  ): UVRegion {
    return this.#with(this.#layout.rotated(quarterTurnsOf(direction), slot));
  }

  toLayout(): UVLayoutData {
    return this.#layout.toJSON();
  }

  toJSON(): UVRegionData {
    return {
      ...this.#identity(),
      ...this.#layout.toJSON()
    };
  }

  #identity(): UVRegionIdentity {
    const identity: UVRegionIdentity = {
      id: this.id,
      color: this.color
    };
    if (this.name !== undefined) {
      identity.name = this.name;
    }

    return identity;
  }

  #with(
    layout: UVLayout
  ): UVRegion {
    if (layout === this.#layout) {
      return this;
    }

    const region = new UVRegion({
      ...this.#identity(),
      ...layout.toJSON()
    });
    region.#layout = layout;

    return region;
  }

  static #layoutOf(
    data: UVRegionData
  ): UVLayout {
    if (data.state === "stacked") {
      return StackedLayout.from(data);
    }

    const faces = new UVSlotMap(data.faces);
    const activeSlots = data.activeFaces ?? faces.slots;

    return data.state === "unfolded" ?
      new NetLayout(faces, activeSlots) :
      new FreeLayout(faces, activeSlots);
  }
}
