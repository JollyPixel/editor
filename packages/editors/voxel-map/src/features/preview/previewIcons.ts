/* eslint-disable @stylistic/max-len */
// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("preview-play", svg`
  <path
    d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"
    fill="currentColor"
  />
`);

registerIcon("preview-pause", svg`
  <path
    d="M6 5h4v14H6ZM14 5h4v14h-4Z"
    fill="currentColor"
  />
`);
