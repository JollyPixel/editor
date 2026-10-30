// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("terrain-exchange", svg`
  <path
    class="tone-ink"
    d="M8 4v13M8 4 4 8M8 4l4 4M16 20V7M16 20l-4-4M16 20l4-4"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "amber" });
