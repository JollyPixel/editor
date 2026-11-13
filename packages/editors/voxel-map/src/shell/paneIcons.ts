/* eslint-disable @stylistic/max-len */
// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("material", svg`
  <circle
    class="tone-fill"
    cx="12"
    cy="12"
    r="9"
  />
  <circle
    cx="12"
    cy="12"
    r="9"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  />
  <path
    d="M7.5 10a5 5 0 0 1 4-4"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
  />
`, { tone: "lime" });

registerIcon("layers", svg`
  <path
    class="tone-fill"
    d="M12 3 21 8l-9 5-9-5 9-5z"
  />
  <path
    d="M12 3 21 8l-9 5-9-5 9-5zM3 12.5l9 5 9-5M3 17l9 5 9-5"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "violet" });
