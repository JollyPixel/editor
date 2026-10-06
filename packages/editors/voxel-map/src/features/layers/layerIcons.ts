/* eslint-disable @stylistic/max-len */
// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

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
