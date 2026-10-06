// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("brush-build", svg`
  <path
    class="tone-ink"
    d="M9.5 6 16 9.75 9.5 13.5 3 9.75Z"
    fill="currentColor"
    fill-opacity="0.4"
  />
  <path
    class="tone-ink"
    d="M9.5 6 16 9.75v7.5L9.5 21 3 17.25v-7.5ZM3 9.75l6.5 3.75L16 9.75M9.5 13.5V21"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linejoin="round"
  />
  <path
    class="tone-ink"
    d="M19 2.5v7M15.5 6h7"
    fill="none"
    stroke="currentColor"
    stroke-width="2.4"
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
`, { tone: "sky" });

registerIcon("pattern-square", svg`
  <rect
    class="tone-ink"
    x="4.5"
    y="4.5"
    width="15"
    height="15"
    rx="1.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
  />
  <circle
    class="tone-ink"
    cx="12"
    cy="12"
    r="2"
    fill="currentColor"
  />
`, { tone: "amber" });

registerIcon("pattern-circle", svg`
  <circle
    class="tone-ink"
    cx="12"
    cy="12"
    r="7.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
  />
  <circle
    class="tone-ink"
    cx="12"
    cy="12"
    r="2"
    fill="currentColor"
  />
`, { tone: "amber" });

registerIcon("brush-ghost", svg`
  <path
    class="tone-ink"
    d="M5 20.5V11a7 7 0 0 1 14 0v9.5l-2.33-1.75-2.34 1.75L12 18.75l-2.33 1.75-2.34-1.75Z"
    fill="currentColor"
    fill-opacity="0.4"
  />
  <path
    class="tone-ink"
    d="M5 20.5V11a7 7 0 0 1 14 0v9.5l-2.33-1.75-2.34 1.75L12 18.75l-2.33 1.75-2.34-1.75Z"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
  />
  <circle
    class="tone-ink"
    cx="9.5"
    cy="11"
    r="1.5"
    fill="currentColor"
  />
  <circle
    class="tone-ink"
    cx="14.5"
    cy="11"
    r="1.5"
    fill="currentColor"
  />
`, { tone: "violet" });
