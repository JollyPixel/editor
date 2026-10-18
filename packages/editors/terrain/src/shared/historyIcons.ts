// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("undo", svg`
  <path class="tone-ink" d="M8.5 4 3 9l5.5 5Z" fill="currentColor" />
  <path
    class="tone-ink"
    d="M7 9h7.5a5 5 0 0 1 0 10H10"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "teal" });

registerIcon("redo", svg`
  <path class="tone-ink" d="M15.5 4 21 9l-5.5 5Z" fill="currentColor" />
  <path
    class="tone-ink"
    d="M17 9H9.5a5 5 0 0 0 0 10H14"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "teal" });
