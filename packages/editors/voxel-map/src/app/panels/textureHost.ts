// Import Third-party Dependencies
import type { PanePlacement } from "@jolly-pixel/ui";
import type { UvAccess } from "@jolly-pixel/editor.pixel-art";

export type TextureHost = "blocks" | "paint";

export function textureUvAccess(
  host: TextureHost
): UvAccess {
  return host === "blocks" ? "edit" : "view";
}

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
