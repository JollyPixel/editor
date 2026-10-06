/* eslint-disable @stylistic/max-len */
// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("map", svg`
  <path
    class="tone-ink"
    d="M9 4l6 2.5v13.5L9 17.5Z"
    fill="currentColor"
    fill-opacity="0.4"
  />
  <path
    class="tone-ink"
    d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20ZM9 4v13.5M15 6.5V20"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "sky" });

registerIcon("pencil", svg`
  <mask id="pencil-ferrule-cut">
    <rect width="24" height="24" fill="#fff" />
    <path d="M13.2 6.3l4.5 4.5" stroke="#000" stroke-width="1.6" />
  </mask>
  <path
    class="tone-ink"
    d="M15.5 3.5a2.1 2.1 0 0 1 3 0l2 2a2.1 2.1 0 0 1 0 3L9 20l-5.5 1.5L5 16 15.5 3.5Z"
    fill="currentColor"
    mask="url(#pencil-ferrule-cut)"
  />
`, { tone: "pink" });

registerIcon("material", svg`
  <circle
    class="tone-fill"
    cx="12"
    cy="12"
    r="9"
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
    d="M7.5 10a5 5 0 0 1 4-4"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
  />
`, { tone: "violet" });
