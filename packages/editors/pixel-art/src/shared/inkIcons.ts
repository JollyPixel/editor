// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

export type InkIconName = "inkBlend" | "inkReplace" | "inkLockAlpha";

registerIcon("inkBlend", svg`
    <rect x="3" y="3" width="12" height="12" rx="1.5" fill="currentColor" fill-opacity="0.35" />
    <rect class="tone-ink" x="9" y="9" width="12" height="12" rx="1.5" fill="currentColor" fill-opacity="0.6" />
  `, { tone: "coral" });

registerIcon("inkReplace", svg`
    <rect x="3" y="3" width="12" height="12" rx="1.5" fill="currentColor" fill-opacity="0.35" />
    <rect class="tone-ink" x="9" y="9" width="12" height="12" rx="1.5" fill="currentColor" />
  `, { tone: "coral" });

registerIcon("inkLockAlpha", svg`
    <clipPath id="ink-lock-alpha-shape">
      <circle cx="12" cy="12" r="8.5" />
    </clipPath>
    <circle cx="12" cy="12" r="8.5" fill="currentColor" fill-opacity="0.35" />
    <rect
      x="1"
      y="8.5"
      width="22"
      height="7"
      fill="none"
      stroke="currentColor"
      stroke-opacity="0.5"
      stroke-dasharray="2 2"
    />
    <rect
      class="tone-ink"
      x="0"
      y="8"
      width="24"
      height="8"
      fill="currentColor"
      clip-path="url(#ink-lock-alpha-shape)"
    />
  `, { tone: "coral" });
