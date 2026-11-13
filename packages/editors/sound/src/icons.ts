// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("sound-wave", svg`
  <path
    class="tone-ink"
    d="M2 12h3l2-5 3 11 3-14 3 12 2-6 1 2h3"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "teal" });

registerIcon("sound-drive", svg`
  <path
    class="tone-fill"
    d="M4 17 3 7l5 4 4-6 4 6 5-4-1 10z"
  />
  <path
    d="M4 17 3 7l5 4 4-6 4 6 5-4-1 10zM5 20.5h14"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "amber" });

registerIcon("sound-listen", svg`
  <rect
    class="tone-fill"
    x="3"
    y="14"
    width="5"
    height="7"
    rx="2"
  />
  <rect
    class="tone-fill"
    x="16"
    y="14"
    width="5"
    height="7"
    rx="2"
  />
  <path
    d="M4 15v-3a8 8 0 0 1 16 0v3"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
  />
  <rect
    x="3"
    y="14"
    width="5"
    height="7"
    rx="2"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  />
  <rect
    x="16"
    y="14"
    width="5"
    height="7"
    rx="2"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  />
`, { tone: "violet" });

registerIcon("sound-backward", svg`
  <path
    class="tone-ink"
    d="M20 12H5M9 8l-4 4 4 4"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "pink" });

registerIcon("sound-forward", svg`
  <path
    class="tone-ink"
    d="M4 12h15M15 8l4 4-4 4"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "lime" });

registerIcon("sound-volume", svg`
  <path
    class="tone-fill"
    d="M4 9h3l5-4v14l-5-4H4z"
  />
  <path
    d="M4 9h3l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "teal" });
