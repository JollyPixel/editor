// Import Third-party Dependencies
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server/kinds";

// Import Internal Dependencies
import { VOXEL_MAP_KIND } from "./kind.ts";

export const VOXEL_MAP_ASSET: AssetKindDescriptor = {
  kind: VOXEL_MAP_KIND,
  label: "Voxel map",
  icon: {
    svg: `
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
    `,
    tone: "lime"
  }
};
