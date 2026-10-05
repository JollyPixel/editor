// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui/icon";

export type NormalMapIconName =
  | "normalMap"
  | "albedo"
  | "sliders";

registerIcon("normalMap", svg`
    <circle
      cx="12"
      cy="12"
      r="8"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
    />
    <path
      class="tone-ink"
      d="M12 4a8 8 0 0 1 0 16 4.5 8 0 0 0 0-16Z"
      fill="currentColor"
      fill-opacity="0.4"
    />
    <path
      class="tone-ink"
      d="M8 10a4 4 0 0 1 2.8-2.8"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
    />
  `, { tone: "violet" });

registerIcon("albedo", svg`
    <rect
      x="4"
      y="4"
      width="16"
      height="16"
      rx="2"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
    />
    <path
      class="tone-ink"
      d="M4 15l5-5 4 4 2.5-2.5L20 16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"
      fill="currentColor"
    />
  `);

registerIcon("sliders", svg`
    <path
      d="M4 8h16M4 16h16"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
    />
    <circle
      class="tone-ink"
      cx="9"
      cy="8"
      r="2.6"
      fill="currentColor"
    />
    <circle
      class="tone-ink"
      cx="15"
      cy="16"
      r="2.6"
      fill="currentColor"
    />
  `);
