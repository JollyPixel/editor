// Import Third-party Dependencies
import type { PanePlacement } from "@jolly-pixel/ui";
import type { UvAccess } from "@jolly-pixel/editor.pixel-art";

export type TextureHost = "blocks" | "paint";

export function textureUvAccess(
  host: TextureHost,
  grouped: boolean
): UvAccess {
  return host === "paint" && grouped ? "view" : "edit";
}

export function texturePanesGrouped(
  blocks: PanePlacement | null,
  paint: PanePlacement | null
): boolean {
  return blocks !== null &&
    paint !== null &&
    blocks.dock === paint.dock &&
    blocks.column === paint.column &&
    blocks.index === paint.index;
}

export function resolveTextureHost(
  blocks: PanePlacement | null,
  paint: PanePlacement | null,
  current: TextureHost
): TextureHost {
  if (
    blocks === null ||
    paint === null ||
    !texturePanesGrouped(blocks, paint)
  ) {
    return "paint";
  }
  if (blocks.active) {
    return "blocks";
  }

  return paint.active ? "paint" : current;
}
