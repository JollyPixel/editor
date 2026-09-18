// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("brush-build", svg`
  <path
    d="M10 3 17 7v8l-7 4-7-4V7Z M3 7l7 4 7-4 M10 11v8"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linejoin="round"
  />
  <path
    d="M19 14v7M15.5 17.5h7"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
  />
`);

registerIcon("brush-replace", svg`
  <path
    d="M12 7 17 10v5l-5 3-5-3v-5Z M7 10l5 3 5-3 M12 13v5"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linejoin="round"
  />
  <path
    d="M4 9a9 9 0 0 1 14.5-5.2M20 15a9 9 0 0 1-14.5 5.2"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
  />
  <path
    d="M19.5 1v3.5H16M4.5 23v-3.5H8"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`);

registerIcon("pattern-square", svg`
  <rect
    x="5"
    y="5"
    width="14"
    height="14"
    rx="1.5"
    fill="currentColor"
    fill-opacity="0.25"
    stroke="currentColor"
    stroke-width="1.75"
  />
`);

registerIcon("pattern-circle", svg`
  <circle
    cx="12"
    cy="12"
    r="7.5"
    fill="currentColor"
    fill-opacity="0.25"
    stroke="currentColor"
    stroke-width="1.75"
  />
`);

registerIcon("brush-ghost", svg`
  <path
    d="M12 3 20 7.5v9L12 21l-8-4.5v-9Z"
    fill="currentColor"
    fill-opacity="0.2"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linejoin="round"
    stroke-dasharray="2.5 2"
  />
  <path
    d="M4 7.5 12 12l8-4.5M12 12v9"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linejoin="round"
    stroke-dasharray="2.5 2"
  />
`);

registerIcon("history-undo", svg`
  <path
    d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`);

registerIcon("history-redo", svg`
  <path
    d="M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`);
