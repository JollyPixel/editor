// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("overlay-none", svg`
  <path
    class="tone-fill"
    d="M2 17 8 9h14l-6 8Z"
  />
  <path
    class="tone-ink"
    d="M2 17 8 9h14l-6 8Z"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
  />
`, { tone: "lime" });

registerIcon("overlay-chunks", svg`
  <path
    class="tone-ink"
    d="M4 4h16v16H4ZM12 4v16M4 12h16"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
  />
`, { tone: "sky" });

registerIcon("overlay-lod", svg`
  <path
    class="tone-fill"
    d="M12 12h8v8h-8Z"
  />
  <path
    class="tone-ink"
    d="M4 4h16v16H4ZM12 4v16M4 12h16M16 12v8M12 16h8"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linejoin="round"
  />
`, { tone: "violet" });

registerIcon("overlay-slope", svg`
  <path
    class="tone-fill"
    d="M3 20h18L21 6Z"
  />
  <path
    class="tone-ink"
    d="M3 20h18V6ZM14 20a7 7 0 0 0-1-3.6"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
  />
`, { tone: "coral" });

registerIcon("overlay-splat", svg`
  <path
    class="tone-fill"
    d="M4 4h9c-1 4 2 6 7 6v10H4Z"
  />
  <path
    class="tone-ink"
    d="M4 4h16v16H4ZM13 4c-1 4 2 6 7 6M4 15c4-2 7 0 9 5"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
  />
`, { tone: "amber" });

registerIcon("overlay-holes", svg`
  <path
    class="tone-fill"
    d="M8 8h8v8H8Z"
  />
  <path
    class="tone-ink"
    d="M4 4h16v16H4ZM8 8h8v8H8Z"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
  />
`, { tone: "violet" });
