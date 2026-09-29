// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("archive-export", svg`
  <path
    class="tone-ink"
    d="M12 4v11"
    stroke="currentColor"
    stroke-width="2.4"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    class="tone-ink"
    d="M7.5 10.5 12 15l4.5-4.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2.4"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"
    fill="none"
    stroke="currentColor"
    stroke-width="2.4"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "sky" });

registerIcon("archive-import", svg`
  <path
    class="tone-ink"
    d="M12 15V4"
    stroke="currentColor"
    stroke-width="2.4"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    class="tone-ink"
    d="M7.5 8.5 12 4l4.5 4.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2.4"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"
    fill="none"
    stroke="currentColor"
    stroke-width="2.4"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "lime" });
