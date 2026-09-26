// Import Third-party Dependencies
import type { PixelBufferHookEvent } from "@jolly-pixel/pixel-draw.renderer";

// CONSTANTS
const kActions: { readonly [TAction in PixelCommandAction]: true; } = {
  stroke: true,
  resized: true,
  "texture-replaced": true,
  "global-fill": true,
  "select-edit": true,
  "uv-region-created": true,
  "uv-region-deleted": true,
  "uv-region-moved": true,
  "uv-region-state-changed": true,
  "uv-region-rotated": true
};

export type PixelCommandAction = PixelBufferHookEvent["action"];

export const PIXEL_COMMAND_ACTIONS: readonly PixelCommandAction[] = Object.keys(
  kActions
) as PixelCommandAction[];

export function isPixelCommandAction(
  action: string
): action is PixelCommandAction {
  return Object.hasOwn(kActions, action);
}
