// Import Internal Dependencies
import type {
  AreaRect,
  PointerPosition
} from "./area.ts";

// CONSTANTS
const kTurn = 360;
const kRadians = Math.PI / 180;

export const DISCRETE_HUE_STEP = 30;
export const DISCRETE_SATURATION_STEPS = 4;

export interface HueSaturation {
  h: number;
  s: number;
}

export function hueSaturationFromPointer(
  pointer: PointerPosition,
  rect: AreaRect
): HueSaturation {
  const radius = Math.min(rect.width, rect.height) / 2;
  const dx = pointer.x - (rect.left + (rect.width / 2));
  const dy = pointer.y - (rect.top + (rect.height / 2));

  return hueSaturationAt(dx / radius, dy / radius);
}

export function hueSaturationAt(
  x: number,
  y: number
): HueSaturation {
  const angle = Math.atan2(x, -y) / kRadians;

  return {
    h: ((angle % kTurn) + kTurn) % kTurn,
    s: Math.min(Math.hypot(x, y), 1)
  };
}

export function wheelPosition(
  point: HueSaturation
): PointerPosition {
  const angle = point.h * kRadians;

  return {
    x: 0.5 + (Math.sin(angle) * point.s / 2),
    y: 0.5 - (Math.cos(angle) * point.s / 2)
  };
}

export function snapToWheel(
  point: HueSaturation
): HueSaturation {
  const sector = Math.round(point.h / DISCRETE_HUE_STEP) * DISCRETE_HUE_STEP;

  return {
    h: sector % kTurn,
    s: Math.round(point.s * DISCRETE_SATURATION_STEPS) / DISCRETE_SATURATION_STEPS
  };
}
