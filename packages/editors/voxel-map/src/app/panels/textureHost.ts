// Import Third-party Dependencies
import type { PanePlacement } from "@jolly-pixel/ui";

export type TextureHost = "blocks" | "paint";

export function resolveTextureHost(
  blocks: PanePlacement | null,
  paint: PanePlacement | null,
  current: TextureHost
): TextureHost {
  if (
    blocks === null ||
    paint === null ||
    blocks.dock !== paint.dock ||
    blocks.index !== paint.index
  ) {
    return "paint";
  }
  if (blocks.active) {
    return "blocks";
  }

  return paint.active ? "paint" : current;
}
