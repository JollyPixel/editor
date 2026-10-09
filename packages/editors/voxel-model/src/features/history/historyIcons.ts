// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("history-undo", svg`
  <path
    class="tone-ink"
    d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "teal" });

registerIcon("history-redo", svg`
  <path
    class="tone-ink"
    d="M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "teal" });
