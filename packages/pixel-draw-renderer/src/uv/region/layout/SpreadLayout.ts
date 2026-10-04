// Import Internal Dependencies
import { rectOf } from "../../geometry/geometry.ts";
import { RectArea } from "../../../utils/RectArea.ts";
import type { UVSlotMap } from "../UVSlotMap.ts";
import {
  UVLayout,
  type UVLayoutData,
  type UVRegionSlot
} from "./UVLayout.ts";
import type {
  UVGeometry,
  UVSlot
} from "../../geometry/types.ts";
import type {
  SelectionRect,
  Vec2
} from "../../../types.ts";

export abstract class SpreadLayout extends UVLayout {
  abstract override readonly state: "unfolded" | "free";

  get bounds(): SelectionRect {
    const [first, ...rest] = this.activeSlots.map(
      (slot) => rectOf(this.faces.get(slot))
    );

    return rest.reduce(
      (area, rect) => area.union(rect),
      RectArea.from(first)
    ).bounds;
  }

  geometryFor(
    slot: UVSlot
  ): UVGeometry {
    return this.faces.get(slot);
  }

  slotsOf(): UVRegionSlot[] {
    return this.activeSlots.map((slot) => {
      return {
        slot,
        geometry: this.faces.get(slot)
      };
    });
  }

  spreadFaces(): UVSlotMap {
    return this.faces;
  }

  translated(
    delta: Vec2
  ): SpreadLayout {
    if (delta.x === 0 && delta.y === 0) {
      return this;
    }

    return this.withFaces(this.faces.translated(delta.x, delta.y));
  }

  toJSON(): UVLayoutData {
    return {
      state: this.state,
      faces: this.faces.toJSON(),
      activeFaces: [...this.activeSlots]
    };
  }

  abstract withFaces(
    faces: UVSlotMap
  ): SpreadLayout;
}
