// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("marquee", svg`
  <path
    class="tone-ink"
    d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"
    fill="none"
    stroke="currentColor"
    stroke-width="2.4"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "sky" });

registerIcon("select-connected", svg`
  <path
    class="tone-ink"
    d="M4 4h7v9h9v7H4Z"
    fill="currentColor"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linejoin="round"
  />
`, { tone: "sky" });
