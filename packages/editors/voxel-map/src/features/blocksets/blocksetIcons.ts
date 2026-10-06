// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("blockset", svg`
  <path
    class="tone-ink"
    d="M5 3h7v9H3V5a2 2 0 0 1 2-2Z"
    fill="currentColor"
    fill-opacity="0.4"
  />
  <rect
    class="tone-ink"
    x="3"
    y="3"
    width="18"
    height="18"
    rx="2"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
  />
  <path
    class="tone-ink"
    d="M12 3v18M3 12h18"
    stroke="currentColor"
    stroke-width="2.2"
  />
`, { tone: "pink" });
