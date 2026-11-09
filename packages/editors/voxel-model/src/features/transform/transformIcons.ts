// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("transform-position", svg`
  <path
    d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "sky" });

registerIcon("transform-angle", svg`
  <circle
    class="tone-fill"
    cx="12"
    cy="12"
    r="2.5"
    stroke="currentColor"
    stroke-width="1.75"
  />
  <path
    d="M12 4a8 8 0 1 0 8 8M9.5 1.5 12 4l-2.5 2.5"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "lime" });

registerIcon("transform-size", svg`
  <rect
    class="tone-ink"
    x="4"
    y="10"
    width="10"
    height="10"
    rx="1.5"
    fill="currentColor"
  />
  <path
    d="M14 10l6-6M15 4h5v5"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "violet" });

registerIcon("transform-pivot", svg`
  <circle
    class="tone-ink"
    cx="12"
    cy="12"
    r="6.5"
    fill="currentColor"
  />
  <path
    d="M12 2.5v3.5M12 18v3.5M2.5 12H6M18 12h3.5"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
  />
`, { tone: "pink" });

registerIcon("transform-scale", svg`
  <rect
    class="tone-ink"
    x="4"
    y="12"
    width="8"
    height="8"
    rx="1.5"
    fill="currentColor"
  />
  <path
    d="M4 9V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-dasharray="2.5 2.2"
  />
  <path
    d="M12 12l5-5M13 7h4v4"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "coral" });

registerIcon("transform-local", svg`
  <rect
    x="4"
    y="4"
    width="16"
    height="16"
    rx="3"
    stroke="currentColor"
    stroke-width="1.75"
  />
  <path
    class="tone-ink"
    d="M10 8v8h5"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "amber" });

registerIcon("transform-global", svg`
  <rect
    x="4"
    y="4"
    width="16"
    height="16"
    rx="3"
    stroke="currentColor"
    stroke-width="1.75"
  />
  <path
    class="tone-ink"
    d="M7.5 8l1.75 8L12 10.5 14.75 16 16.5 8"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "teal" });
