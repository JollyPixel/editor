// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("brush-build", svg`
  <path
    class="tone-fill"
    d="M10 3 17 7v8l-7 4-7-4V7Z"
  />
  <path
    d="M10 3 17 7v8l-7 4-7-4V7Z M3 7l7 4 7-4 M10 11v8"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linejoin="round"
  />
  <path
    class="tone-ink"
    d="M19 14v7M15.5 17.5h7"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
  />
`, { tone: "lime" });

registerIcon("brush-replace", svg`
  <path
    class="tone-fill"
    d="M12 7 17 10v5l-5 3-5-3v-5Z"
  />
  <path
    d="M12 7 17 10v5l-5 3-5-3v-5Z M7 10l5 3 5-3 M12 13v5"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linejoin="round"
  />
  <path
    class="tone-ink"
    d="M4 9a9 9 0 0 1 14.5-5.2M20 15a9 9 0 0 1-14.5 5.2"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
  />
  <path
    class="tone-ink"
    d="M19.5 1v3.5H16M4.5 23v-3.5H8"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "amber" });

registerIcon("pattern-square", svg`
  <rect
    class="tone-fill"
    x="5"
    y="5"
    width="14"
    height="14"
    rx="1.5"
    stroke="currentColor"
    stroke-width="1.75"
  />
`, { tone: "sky" });

registerIcon("pattern-circle", svg`
  <circle
    class="tone-fill"
    cx="12"
    cy="12"
    r="7.5"
    stroke="currentColor"
    stroke-width="1.75"
  />
`, { tone: "sky" });

registerIcon("brush-ghost", svg`
  <path
    class="tone-fill"
    d="M5 20.5V11a7 7 0 0 1 14 0v9.5L16.67 18.75 14.33 20.5 12 18.75 9.67 20.5 7.33 18.75Z"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linejoin="round"
  />
  <circle
    cx="9.5"
    cy="11"
    r="1.5"
    fill="currentColor"
  />
  <circle
    cx="14.5"
    cy="11"
    r="1.5"
    fill="currentColor"
  />
`, { tone: "violet" });

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
