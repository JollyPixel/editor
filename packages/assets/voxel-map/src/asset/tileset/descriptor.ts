// Import Third-party Dependencies
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server/kinds";

// Import Internal Dependencies
import { TILESET_KIND } from "./kind.ts";

export const TILESET_ASSET: AssetKindDescriptor = {
  kind: TILESET_KIND,
  label: "Tileset",
  icon: {
    svg: `
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="1.5"
        fill="currentColor"
        opacity="0.35"
      />
      <path
        class="tone-ink"
        d="M9 3v18M15 3v18M3 9h18M3 15h18"
        stroke="currentColor"
        stroke-width="2"
        fill="none"
      />
    `,
    tone: "amber"
  }
};
