// Import Internal Dependencies
import {
  geometryAt,
  boundingRect,
  rectKey,
  sameRect
} from "../../geometry/geometry.ts";
import { UVNet } from "../UVNet.ts";
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
import type {
  UVGeometry,
  UVSlot
} from "../../geometry/types.ts";
import type {
  SelectionRect,
  Vec2
} from "../../../types.ts";

export class NetLayout extends SpreadLayout {
  readonly state = "unfolded";
  readonly movementScope: UVMovementScope = "region";

  static unfolding(
    layout: UVLayout,
    net: UVNet = UVNet.packed
  ): NetLayout {
    const spread = layout.spreadFaces();
    const packed = net.place(
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

  slotRect(): SelectionRect {
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

    const previous = boundingRect(this.faces.get(slot));
    if (sameRect(previous, rect)) {
      return this;
    }
    const cells = this.#cells(slot);
    const leads = [...cells.keys()];
    if (options.aligned) {
      return alignedResizes(
        this.faces,
        leads,
        slot,
        previous,
        rect
      ).reduce(
        (layout, { slot: face, edge, delta }) => layout.resized(
          withEdgeMoved(boundingRect(layout.faces.get(face)), edge, delta),
          face
        ),
        this.resized(rect, slot)
      );
    }

    const slid = slidNeighbors(this.faces, leads, slot, previous, rect)
      .set(slot, geometryAt(this.faces.get(slot), rect));
    const moved = new Map<UVSlot, UVGeometry>();
    for (const [lead, geometry] of slid) {
      for (const member of cells.get(lead)!) {
        moved.set(
          member,
          geometryAt(this.faces.get(member), boundingRect(geometry))
        );
      }
    }

    return this.withFaces(this.faces.withSlots(moved));
  }

  rotated(
    turns: number
  ): NetLayout {
    return this.withFaces(this.faces.rotatedWithin(this.bounds, turns));
  }

  resizeTargets(): UVLayoutResizeTarget[] {
    return [...this.#cells(null).keys()].map((slot) => {
      return {
        slot,
        rect: boundingRect(this.faces.get(slot)),
        handles: UV_NET_RESIZE_HANDLES
      };
    });
  }

  #cells(
    lead: UVSlot | null
  ): Map<UVSlot, UVSlot[]> {
    const cells = Map.groupBy(
      this.activeSlots,
      (slot) => rectKey(boundingRect(this.faces.get(slot)))
    );

    return new Map(
      [...cells.values()].map((members) => [
        lead !== null && members.includes(lead) ? lead : members[0],
        members
      ])
    );
  }

  withFaces(
    faces: UVSlotMap
  ): NetLayout {
    return new NetLayout(faces, this.activeSlots);
  }
}
