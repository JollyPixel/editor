// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("model-cube", svg`
  <path
    class="tone-fill"
    d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"
  />
  <path
    d="M12 3 20 7.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
  />
`, { tone: "sky" });

registerIcon("model-animate", svg`
  <path
    class="tone-fill"
    d="M10 8.5v7l6-3.5-6-3.5Z"
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
    d="M10 8.5v7l6-3.5-6-3.5Z"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
  />
`, { tone: "lime" });
