/* eslint-disable @stylistic/max-len */
// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";
import "@jolly-pixel/editor.pixel-art";

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

registerIcon("tileset", svg`
  <path
    class="tone-ink"
    d="M5 3h7v9H3V5a2 2 0 0 1 2-2Z"
    fill="currentColor"
    fill-opacity="0.4"
  />
  <rect
    class="tone-ink"
    x="3"
    y="3"
    width="18"
    height="18"
    rx="2"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
  />
  <path
    class="tone-ink"
    d="M12 3v18M3 12h18"
    stroke="currentColor"
    stroke-width="2.2"
  />
`, { tone: "pink" });

registerIcon("blocks", svg`
  <path
    class="tone-ink"
    d="M12 3 19.79 7.5 12 12 4.21 7.5Z"
    fill="currentColor"
    fill-opacity="0.4"
  />
  <path
    class="tone-ink"
    d="M12 3 19.79 7.5v9L12 21l-7.79-4.5v-9ZM4.21 7.5 12 12l7.79-4.5M12 12v9"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linejoin="round"
  />
`, { tone: "amber" });

registerIcon("block-edit", svg`
  <path
    class="tone-ink"
    d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"
    fill="none"
    stroke="currentColor"
    stroke-width="2.4"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    class="tone-ink"
    d="M18.3 2.7a2 2 0 0 1 2.9 2.9l-8.7 8.7-3.6.8.8-3.6Z"
    fill="currentColor"
  />
`, { tone: "amber" });

registerIcon("order-registry", svg`
  <path
    class="tone-ink"
    d="M3.5 4.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1ZM13.5 4.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1ZM3.5 14.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1ZM13.5 14.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1Z"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
  />
`, { tone: "amber" });

registerIcon("order-usage", svg`
  <path
    class="tone-ink"
    d="M9 5h6v15H9Z"
    fill="currentColor"
    fill-opacity="0.4"
  />
  <path
    class="tone-ink"
    d="M3 20V10h6V5h6v8h6v7ZM9 10v10M15 13v7"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linejoin="round"
  />
`, { tone: "amber" });

registerIcon("voxel-layer", svg`
  <path
    class="tone-ink"
    d="M12 5 21 9.5 12 14 3 9.5Z"
    fill="currentColor"
    fill-opacity="0.4"
  />
  <path
    class="tone-ink"
    d="M12 5 21 9.5v4.5L12 18.5 3 14V9.5ZM3 9.5l9 4.5 9-4.5M12 14v4.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linejoin="round"
  />
`, { tone: "violet" });

registerIcon("object-layer", svg`
  <path
    class="tone-ink"
    d="M10.5 3H9C7.34315 3 6 4.34315 6 6V9C6 10.1046 5.10457 11 4 11H3V13H4C5.10457 13 6 13.8954 6 15V18C6 19.6569 7.34315 21 9 21H10.5V19H9C8.44772 19 8 18.5523 8 18V15C8 13.8135 7.31672 12.7865 6.32297 12C7.31672 11.2135 8 10.1865 8 9V6C8 5.44772 8.44772 5 9 5H10.5V3Z"
    fill="currentColor"
  />
  <path
    class="tone-ink"
    d="M13.5 3H15C16.6569 3 18 4.34315 18 6V9C18 10.1046 18.8954 11 20 11H21V13H20C18.8954 13 18 13.8954 18 15V18C18 19.6569 16.6569 21 15 21H13.5V19H15C15.5523 19 16 18.5523 16 18V15C16 13.8135 16.6833 12.7865 17.677 12C16.6833 11.2135 16 10.1865 16 9V6C16 5.44772 15.5523 5 15 5H13.5V3Z"
    fill="currentColor"
  />
`, { tone: "teal" });

registerIcon("object-area", svg`
  <rect
    class="tone-ink"
    x="3"
    y="8"
    width="13"
    height="13"
    rx="1"
    fill="currentColor"
    fill-opacity="0.4"
  />
  <path
    class="tone-ink"
    d="M3 8l5-5h13v13l-5 5M16 8l5-5M3 8h13v13H3Z"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    class="tone-ink"
    d="M8 3v13h13M8 16l-5 5"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-dasharray="2 2"
    stroke-opacity="0.4"
  />
`, { tone: "teal" });

registerIcon("merge", svg`
  <path
    class="tone-ink"
    d="M4 8V4h16v4"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    class="tone-ink"
    d="M12 7v8M8.5 11.5 12 15l3.5-3.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2.4"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <rect
    class="tone-ink"
    x="3"
    y="17"
    width="18"
    height="4.5"
    rx="1"
    fill="currentColor"
  />
`, { tone: "violet" });

registerIcon("layers", svg`
  <path
    class="tone-fill"
    d="M12 3 21 8l-9 5-9-5 9-5z"
  />
  <path
    d="M12 3 21 8l-9 5-9-5 9-5zM3 12.5l9 5 9-5M3 17l9 5 9-5"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "violet" });

registerIcon("template", svg`
  <path
    class="tone-ink"
    d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1Z"
    fill="currentColor"
  />
`, { tone: "violet" });

registerIcon("template-save", svg`
  <path
    class="tone-ink"
    fill-rule="evenodd"
    d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1ZM10.7 5.5h2.6v2.7H16v2.6h-2.7v2.7h-2.6v-2.7H8V8.2h2.7Z"
    fill="currentColor"
  />
`, { tone: "violet" });

registerIcon("template-place", svg`
  <path
    class="tone-ink"
    fill-rule="evenodd"
    d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1ZM10.7 5h2.6v4.2H16l-4 4.6-4-4.6h2.7Z"
    fill="currentColor"
  />
`, { tone: "violet" });

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

registerIcon("rebase", svg`
  <rect
    class="tone-ink"
    x="4"
    y="8"
    width="12"
    height="12"
    fill="currentColor"
    fill-opacity="0.4"
  />
  <path
    class="tone-ink"
    d="M4 3v17h17M4 8h12v12"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <circle
    class="tone-ink"
    cx="4"
    cy="20"
    r="2.4"
    fill="currentColor"
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
