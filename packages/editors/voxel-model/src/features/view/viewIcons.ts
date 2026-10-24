// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("view-studio", svg`
  <path
    class="tone-ink"
    d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "amber" });

registerIcon("view-day", svg`
  <circle
    class="tone-ink"
    cx="12"
    cy="12"
    r="4"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  />
  <path
    d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
  />
`, { tone: "amber" });

registerIcon("view-night", svg`
  <path
    class="tone-ink"
    d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
  />
`, { tone: "violet" });

registerIcon("key-light-front-left", svg`
  <rect
    x="11"
    y="11"
    width="9"
    height="9"
    rx="1"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  />
  <path
    class="tone-ink"
    d="M3 3l6 6M9 4v5H4"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "amber" });

registerIcon("key-light-front-right", svg`
  <rect
    x="4"
    y="11"
    width="9"
    height="9"
    rx="1"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  />
  <path
    class="tone-ink"
    d="M21 3l-6 6M15 4v5h5"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "amber" });

registerIcon("key-light-top", svg`
  <rect
    x="7.5"
    y="13"
    width="9"
    height="8"
    rx="1"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  />
  <path
    class="tone-ink"
    d="M12 2v8M8.5 6.5 12 10l3.5-3.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "amber" });

registerIcon("view-flat", svg`
  <rect
    x="5"
    y="5"
    width="14"
    height="14"
    rx="1.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  />
  <path
    class="tone-ink"
    d="M5 12h14M12 5v14"
    stroke="currentColor"
    stroke-width="2"
  />
`, { tone: "sky" });
