// Import Internal Dependencies
import { clampRectPosition } from "../../utils/math.ts";
import type {
  SelectionRect,
  Vec2
} from "../../types.ts";
import type {
  UVRegion,
  UVResizeOptions,
  UVSlot
} from "../region/UVRegion.ts";

export class CanvasBounds {
  readonly size: Vec2;

  constructor(
    size: Vec2
  ) {
    this.size = size;
  }

  clamp(
    region: UVRegion
  ): UVRegion {
    const bounds = region.bounds;
    const clamped = clampRectPosition(bounds, this.size);

    return region.translated({
      x: clamped.x - bounds.x,
      y: clamped.y - bounds.y
    });
  }

  clampSlot(
    region: UVRegion,
    slot: UVSlot | null
  ): UVRegion {
    if (slot === null) {
      return this.clamp(region);
    }

    return region.movedTo(clampRectPosition(region.rectFor(slot), this.size), slot);
  }

  move(
    region: UVRegion,
    position: Vec2,
    slot: UVSlot | null
  ): UVRegion {
    const clamped = clampRectPosition(
      {
        ...region.rectFor(slot),
        x: position.x,
        y: position.y
      },
      this.size
    );

    return region.movedTo(clamped, slot);
  }

  resize(
    region: UVRegion,
    rect: SelectionRect,
    slot: UVSlot | null,
    options: UVResizeOptions
  ): UVRegion {
    const target = {
      ...rect,
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height)
    };
    const resized = region.resized(target, slot, options);
    const before = region.bounds;
    const after = resized.bounds;
    const left = Math.max(0, Math.min(0, before.x) - after.x);
    const top = Math.max(0, Math.min(0, before.y) - after.y);
    const right = Math.max(
      0,
      after.x + after.width - Math.max(this.size.x, before.x + before.width)
    );
    const bottom = Math.max(
      0,
      after.y + after.height - Math.max(this.size.y, before.y + before.height)
    );
    if (left + top + right + bottom === 0) {
      return resized;
    }

    return region.resized(
      {
        x: target.x + left,
        y: target.y + top,
        width: Math.max(1, target.width - left - right),
        height: Math.max(1, target.height - top - bottom)
      },
      slot,
      options
    );
  }
}
