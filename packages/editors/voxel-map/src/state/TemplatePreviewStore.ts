// Import Third-party Dependencies
import type { StorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { StoredChoice } from "./StoredChoice.ts";

export const TEMPLATE_PREVIEW_MODES = Object.freeze([
  "enabled",
  "disabled"
] as const);

export type TemplatePreviewMode = typeof TEMPLATE_PREVIEW_MODES[number];

export class TemplatePreviewStore extends StoredChoice<TemplatePreviewMode> {
  constructor(
    storage?: StorageAdapter
  ) {
    super({
      key: "voxel-map:template-preview",
      values: TEMPLATE_PREVIEW_MODES,
      fallback: "enabled",
      storage
    });
  }
}
