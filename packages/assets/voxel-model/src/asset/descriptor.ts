// Import Third-party Dependencies
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server/kinds";

// Import Internal Dependencies
import { VOXEL_MODEL_KIND } from "./kind.ts";

export const VOXEL_MODEL_ASSET: AssetKindDescriptor = {
  kind: VOXEL_MODEL_KIND,
  label: "Voxel model",
  icon: {
    svg: `
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
    `,
    tone: "sky"
  }
};
