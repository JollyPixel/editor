// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("timeline-play", svg`
  <path
    class="tone-fill"
    d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linejoin="round"
  />
`, { tone: "teal" });

registerIcon("timeline-key", svg`
  <path
    class="tone-fill"
    d="M12 3.5l8.5 8.5-8.5 8.5L3.5 12z"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linejoin="round"
  />
`, { tone: "amber" });

registerIcon("timeline-loop", svg`
  <path
    d="M4 12a6 6 0 0 1 6-6h8m0 0-3-3m3 3-3 3M20 12a6 6 0 0 1-6 6H6m0 0 3 3m-3-3 3-3"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`);

registerIcon("timeline-pause", svg`
  <rect class="tone-fill" x="6" y="4" width="4" height="16" rx="1" stroke="currentColor" stroke-width="1.5" />
  <rect class="tone-fill" x="14" y="4" width="4" height="16" rx="1" stroke="currentColor" stroke-width="1.5" />
`, { tone: "teal" });
