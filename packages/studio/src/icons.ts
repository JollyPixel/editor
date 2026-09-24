// Import Third-party Dependencies
import { PIXEL_ART_KIND } from "@jolly-pixel/asset.pixel-art";
import { VOXEL_MAP_KIND } from "@jolly-pixel/asset.voxel-map";
import { VOXEL_MODEL_KIND } from "@jolly-pixel/asset.voxel-model";
import {
  registerIcon,
  type IconName
} from "@jolly-pixel/ui";

// CONSTANTS
const kKindIcons: ReadonlyMap<string, IconName> = new Map([
  [VOXEL_MAP_KIND, "map"],
  [VOXEL_MODEL_KIND, "cube"],
  [PIXEL_ART_KIND, "image"]
]);
const kFallbackIcon: IconName = "file";

registerIcon("folder", `
  <path
    d="M3 5a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5Z"
    fill="currentColor"
  />
`, { tone: "amber" });

registerIcon("map", `
  <path
    d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z"
    fill="currentColor"
    opacity="0.35"
  />
  <path
    class="tone-ink"
    d="M9 4v14M15 6v14"
    stroke="currentColor"
    stroke-width="2"
    fill="none"
  />
`, { tone: "lime" });

registerIcon("cube", `
  <path
    d="M12 2 3 7v10l9 5 9-5V7l-9-5Z"
    fill="currentColor"
    opacity="0.35"
  />
  <path
    class="tone-ink"
    d="M3 7l9 5 9-5M12 12v10"
    stroke="currentColor"
    stroke-width="2"
    fill="none"
  />
`, { tone: "sky" });

registerIcon("image", `
  <rect
    x="3"
    y="4"
    width="18"
    height="16"
    rx="2"
    fill="currentColor"
    opacity="0.35"
  />
  <path
    class="tone-ink"
    d="M5 17l4-5 3 3 2-2 5 4H5Z"
    fill="currentColor"
  />
  <circle class="tone-ink" cx="16" cy="9" r="2" fill="currentColor" />
`, { tone: "pink" });

registerIcon("pencil", `
  <path
    d="M4 20l1-4L16 5l3 3L8 19l-4 1Z"
    fill="currentColor"
    opacity="0.35"
  />
  <path
    class="tone-ink"
    d="M4 20l1-4L16 5l3 3L8 19l-4 1ZM14 7l3 3"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
    fill="none"
  />
`);

registerIcon("trash", `
  <path
    d="M6 7h12l-1 13H7L6 7Z"
    fill="currentColor"
    opacity="0.35"
  />
  <path
    class="tone-ink"
    d="M4 7h16M9 7V4h6v3M10 11v6M14 11v6"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    fill="none"
  />
`);

registerIcon("file", `
  <path
    d="M6 2h8l5 5v15H6V2Z"
    fill="currentColor"
    opacity="0.35"
  />
  <path
    class="tone-ink"
    d="M14 2v5h5"
    fill="currentColor"
  />
`);

export function kindIcon(
  kind: string
): IconName {
  return kKindIcons.get(kind) ?? kFallbackIcon;
}
