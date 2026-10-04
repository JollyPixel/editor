// Import Internal Dependencies
import {
  geometryAt,
  rectOf,
  sameRect
} from "../../geometry/geometry.ts";
import { packNet } from "../netLayout.ts";
import {
  alignedResizes,
  slidNeighbors,
  withEdgeMoved
} from "../netSlide.ts";
import type { UVSlotMap } from "../UVSlotMap.ts";
import { SpreadLayout } from "./SpreadLayout.ts";
import type {
  UVLayout,
  UVMovementScope,
  UVResizeOptions
} from "./UVLayout.ts";
import {
  UV_NET_RESIZE_HANDLES,
  type UVLayoutResizeTarget
} from "./UVResizeTarget.ts";
import type { UVSlot } from "../../geometry/types.ts";
import type {
  SelectionRect,
  Vec2
} from "../../../types.ts";

export class NetLayout extends SpreadLayout {
  readonly state = "unfolded";
  readonly movementScope: UVMovementScope = "region";

  static unfolding(
    layout: UVLayout
  ): NetLayout {
    const spread = layout.spreadFaces();
    const packed = packNet(
      layout.activeSlots.map((face) => {
        return {
          face,
          geometry: spread.get(face)
        };
      }),
      layout.bounds
    );

    return new NetLayout(spread.withSlots(packed), layout.activeSlots);
  }

  rectFor(): SelectionRect {
    return this.bounds;
  }

  movedTo(
    position: Vec2
  ): SpreadLayout {
    const bounds = this.bounds;

    return this.translated({
      x: position.x - bounds.x,
      y: position.y - bounds.y
    });
  }

  resized(
    rect: SelectionRect,
    slot: UVSlot | null,
    options: UVResizeOptions = {}
  ): NetLayout {
    if (!this.isTarget(slot)) {
      return this;
    }

    const previous = rectOf(this.faces.get(slot));
    if (sameRect(previous, rect)) {
      return this;
    }
    if (options.aligned) {
      return alignedResizes(
        this.faces,
        this.activeSlots,
        slot,
        previous,
        rect
      ).reduce(
        (layout, { slot: face, edge, delta }) => layout.resized(
          withEdgeMoved(rectOf(layout.faces.get(face)), edge, delta),
          face
        ),
        this.resized(rect, slot)
      );
    }

    return this.withFaces(
      this.faces.withSlots(
        slidNeighbors(this.faces, this.activeSlots, slot, previous, rect)
          .set(slot, geometryAt(this.faces.get(slot), rect))
      )
    );
  }

  rotated(
    turns: number
  ): NetLayout {
    return this.withFaces(this.faces.rotatedWithin(this.bounds, turns));
  }

  resizeTargets(): UVLayoutResizeTarget[] {
    return this.slotsOf().map(({ slot, geometry }) => {
      return {
        slot,
        rect: rectOf(geometry),
        handles: UV_NET_RESIZE_HANDLES
      };
    });
  }

  withFaces(
    faces: UVSlotMap
  ): NetLayout {
    return new NetLayout(faces, this.activeSlots);
  }
}
