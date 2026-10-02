// Import Internal Dependencies
import {
  clamp,
  clampRectPosition
} from "../../utils/math.ts";
import type {
  SelectionRect,
  Vec2
} from "../../types.ts";
import type {
  UVRegion,
  UVResizeOptions,
  UVSlot
} from "../region/UVRegion.ts";

export function clampRegion(
  region: UVRegion,
  size: Vec2
): UVRegion {
  const bounds = region.bounds;

  return region.translated({
    x: clamp(bounds.x, 0, Math.max(0, size.x - bounds.width)) - bounds.x,
    y: clamp(bounds.y, 0, Math.max(0, size.y - bounds.height)) - bounds.y
  });
}

export function clampRotatedRegion(
  region: UVRegion,
  slot: UVSlot | null,
  size: Vec2
): UVRegion {
  if (slot === null) {
    return clampRegion(region, size);
  }

  const rect = region.rectFor(slot);
  const clamped = clampRectPosition(rect, size);

  return clamped.x === rect.x && clamped.y === rect.y ?
    region :
    region.withRect(clamped, slot);
}

export function moveRegion(
  region: UVRegion,
  rect: SelectionRect,
  slot: UVSlot | null,
  size: Vec2
): UVRegion {
  const current = slot === null ? region.bounds : region.rectFor(slot);
  const clamped = clampRectPosition(
    {
      ...current,
      x: rect.x,
      y: rect.y
    },
    size
  );

  return region.withRect(clamped, slot ?? undefined);
}

export function resizeRegion(
  region: UVRegion,
  rect: SelectionRect,
  slot: UVSlot | undefined,
  options: UVResizeOptions,
  size: Vec2
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
    after.x + after.width - Math.max(size.x, before.x + before.width)
  );
  const bottom = Math.max(
    0,
    after.y + after.height - Math.max(size.y, before.y + before.height)
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
