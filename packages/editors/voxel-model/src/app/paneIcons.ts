// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("model-build", svg`
  <path
    class="tone-fill"
    d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z"
  />
  <path
    d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3ZM4 7.5l8 4.5 8-4.5M12 12v9"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "amber" });

registerIcon("model-paint", svg`
  <path
    class="tone-ink"
    d="M3 17.25V21H6.75L17.81 9.94L14.06 6.19L3 17.25Z"
    fill="currentColor"
  />
  <path
    d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"
    fill="currentColor"
  />
`, { tone: "pink" });

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

registerIcon("model-hierarchy", svg`
  <path
    class="tone-fill"
    d="M4 3h7v5H4zM13 16h7v5h-7z"
  />
  <path
    d="M4 3h7v5H4zM13 9.5h7v5h-7zM13 16h7v5h-7zM7.5 8v10.5H13M7.5 12H13"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "violet" });
