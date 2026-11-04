// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

export type PaletteIconName = "ramp" | "more";

registerIcon("ramp", svg`
    <rect x="2.5" y="6" width="6" height="12" rx="1" fill="currentColor" fill-opacity="0.25" />
    <rect x="9" y="6" width="6" height="12" rx="1" fill="currentColor" fill-opacity="0.6" />
    <rect class="tone-ink" x="15.5" y="6" width="6" height="12" rx="1" fill="currentColor" />
  `, { tone: "violet" });

registerIcon("more", svg`
    <circle cx="5" cy="12" r="2" fill="currentColor" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
    <circle cx="19" cy="12" r="2" fill="currentColor" />
  `);
