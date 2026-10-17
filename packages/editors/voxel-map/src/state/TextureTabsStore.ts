// Import Third-party Dependencies
import type { StorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { StoredChoice } from "./StoredChoice.ts";

export const TEXTURE_TABS_STYLES = Object.freeze([
  "tabs",
  "line"
] as const);

export type TextureTabsStyle = typeof TEXTURE_TABS_STYLES[number];

export class TextureTabsStore extends StoredChoice<TextureTabsStyle> {
  constructor(
    storage?: StorageAdapter
  ) {
    super({
      key: "voxel-map:texture-tabs",
      values: TEXTURE_TABS_STYLES,
      fallback: "tabs",
      storage
    });
  }
}
