// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("transform", svg`
  <path
    class="tone-ink"
    d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "amber" });

registerIcon("flip-x", svg`
  <path
    class="tone-ink"
    d="M12 3v18"
    stroke="currentColor"
    stroke-width="1.4"
    stroke-linecap="round"
  />
  <path class="tone-ink" d="M9 6 3 18h6Z" fill="currentColor" />
  <path
    class="tone-ink"
    d="M15 6l6 12h-6Z"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linejoin="round"
  />
`, { tone: "coral" });

registerIcon("flip-z", svg`
  <path
    class="tone-ink"
    d="M12 3v18"
    stroke="currentColor"
    stroke-width="1.4"
    stroke-linecap="round"
  />
  <path class="tone-ink" d="M9 6 3 18h6Z" fill="currentColor" />
  <path
    class="tone-ink"
    d="M15 6l6 12h-6Z"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linejoin="round"
  />
`, { tone: "sky" });

registerIcon("flip-y", svg`
  <path
    class="tone-ink"
    d="M3 12h18"
    stroke="currentColor"
    stroke-width="1.4"
    stroke-linecap="round"
  />
  <path class="tone-ink" d="M18 9 6 3v6Z" fill="currentColor" />
  <path
    class="tone-ink"
    d="M18 15 6 21v-6Z"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linejoin="round"
  />
`, { tone: "lime" });
