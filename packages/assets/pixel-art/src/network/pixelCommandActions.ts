// Import Third-party Dependencies
import type { PixelCommand } from "@jolly-pixel/pixel-draw.renderer";

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
  "uv-region-rotated": true,
  "normal-map-toggled": true,
  "normal-map-defaults-patched": true,
  "normal-map-zone-set": true,
  "normal-map-zone-deleted": true
};

export type PixelCommandAction = PixelCommand["action"];

export const PIXEL_COMMAND_ACTIONS: readonly PixelCommandAction[] = Object.keys(
  kActions
) as PixelCommandAction[];

export function isPixelCommandAction(
  action: string
): action is PixelCommandAction {
  return Object.hasOwn(kActions, action);
}

export function isPixelCommand<TCommand extends { action: string; }>(
  command: TCommand
): command is Extract<TCommand, { action: PixelCommandAction; }> {
  return isPixelCommandAction(command.action);
}
