// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("audio-source", svg`
  <path
    class="tone-fill"
    d="M4 9h3l5-4v14l-5-4H4z"
  />
  <path
    d="M4 9h3l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "teal" });

registerIcon("audio-listener", svg`
  <path
    class="tone-fill"
    d="M3 16a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2ZM16 16a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2Z"
  />
  <path
    d="M4 15v-3a8 8 0 0 1 16 0v3M3 16a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2ZM16 16a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2Z"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "violet" });

registerIcon("audio-zone", svg`
  <rect
    x="3"
    y="3"
    width="18"
    height="18"
    rx="3"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-dasharray="3 2.5"
  />
  <circle
    class="tone-fill"
    cx="9.5"
    cy="12"
    r="2"
    stroke="currentColor"
    stroke-width="1.75"
  />
  <path
    d="M13 9.5a3.5 3.5 0 0 1 0 5M15.5 7a7 7 0 0 1 0 10"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
  />
`, { tone: "sky" });
