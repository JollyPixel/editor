// Import Internal Dependencies
import { clamp } from "../../utils/math.ts";
import type {
  SelectionRect,
  Vec2
} from "../../types.ts";
import type {
  UVRegion,
  UVResizeOptions,
  UVSlot
} from "../region/UVRegion.ts";

export class UVBounds {
  readonly size: Vec2;
  readonly overflow: number;
  readonly #min: number;
  readonly #max: Vec2;

  constructor(
    size: Vec2,
    overflow = 0
  ) {
    this.size = size;
    this.overflow = overflow;
    this.#min = 0 - overflow;
    this.#max = {
      x: size.x + overflow,
      y: size.y + overflow
    };
  }

  get limit(): SelectionRect | null {
    if (this.overflow === 0 || this.overflow === Infinity) {
      return null;
    }

    return {
      x: this.#min,
      y: this.#min,
      width: this.#max.x - this.#min,
      height: this.#max.y - this.#min
    };
  }

  fit(
    rect: SelectionRect
  ): SelectionRect {
    return {
      ...rect,
      x: clamp(
        rect.x,
        this.#min,
        Math.max(this.#min, this.#max.x - rect.width)
      ),
      y: clamp(
        rect.y,
        this.#min,
        Math.max(this.#min, this.#max.y - rect.height)
      )
    };
  }

  clamp(
    region: UVRegion,
    slot: UVSlot | null = null
  ): UVRegion {
    if (slot !== null) {
      return region.movedTo(this.fit(region.rectFor(slot)), slot);
    }

    const bounds = region.bounds;
    const clamped = this.fit(bounds);

    return region.translated({
      x: clamped.x - bounds.x,
      y: clamped.y - bounds.y
    });
  }

  move(
    region: UVRegion,
    position: Vec2,
    slot: UVSlot | null
  ): UVRegion {
    const clamped = this.fit({
      ...region.rectFor(slot),
      x: position.x,
      y: position.y
    });

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
    const left = Math.max(0, Math.min(this.#min, before.x) - after.x);
    const top = Math.max(0, Math.min(this.#min, before.y) - after.y);
    const right = Math.max(
      0,
      after.x + after.width - Math.max(this.#max.x, before.x + before.width)
    );
    const bottom = Math.max(
      0,
      after.y + after.height - Math.max(this.#max.y, before.y + before.height)
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
