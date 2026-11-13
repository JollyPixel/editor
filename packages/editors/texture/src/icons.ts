// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("texture-image", svg`
  <rect
    class="tone-fill"
    x="3"
    y="4"
    width="18"
    height="16"
    rx="2"
  />
  <rect
    x="3"
    y="4"
    width="18"
    height="16"
    rx="2"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  />
  <path
    d="m3 17 5-5 4 4 3-3 6 6"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
  />
  <circle cx="15.5" cy="8.5" r="1.5" fill="currentColor" />
`, { tone: "sky" });

registerIcon("texture-fit", svg`
  <path
    d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <rect
    class="tone-fill"
    x="8"
    y="8"
    width="8"
    height="8"
    rx="1"
  />
`, { tone: "sky" });

registerIcon("texture-actual-size", svg`
  <path
    d="M6 8.5 8 7v10M16 8.5 18 7v10"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <circle cx="12" cy="10" r="1.25" fill="currentColor" />
  <circle cx="12" cy="15" r="1.25" fill="currentColor" />
`);

registerIcon("texture-zoom-in", svg`
  <circle
    cx="10.5"
    cy="10.5"
    r="6.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  />
  <path
    d="m15.5 15.5 5 5M10.5 7.5v6M7.5 10.5h6"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
  />
`);

registerIcon("texture-zoom-out", svg`
  <circle
    cx="10.5"
    cy="10.5"
    r="6.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  />
  <path
    d="m15.5 15.5 5 5M7.5 10.5h6"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
  />
`);

registerIcon("texture-pixelated", svg`
  <path
    class="tone-fill"
    d="M4 4h5v5H4zM9 9h6v6H9zM15 15h5v5h-5zM15 4h5v5h-5zM4 15h5v5H4z"
  />
  <rect
    x="4"
    y="4"
    width="16"
    height="16"
    rx="1"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  />
`, { tone: "lime" });
