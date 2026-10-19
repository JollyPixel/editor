// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui/icon";

export type GridIconName = "grid" | "magnet";

registerIcon("grid", svg`
    <rect
      x="3.5"
      y="3.5"
      width="17"
      height="17"
      rx="2"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
    />
    <path
      class="tone-ink"
      d="M12 3.5v17M3.5 12h17"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
    />
  `, { tone: "amber" });

registerIcon("magnet", svg`
    <path
      d="M6 4v8a6 6 0 0 0 12 0V4"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
    />
    <path
      class="tone-ink"
      d="M4 6h4M16 6h4"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
    />
  `, { tone: "coral" });
