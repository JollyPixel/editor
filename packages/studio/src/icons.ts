// Import Third-party Dependencies
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("folder", `
  <path
    d="M3 5a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5Z"
    fill="currentColor"
  />
`, { tone: "amber" });

registerIcon("pencil", `
  <path
    d="M4 20l1-4L16 5l3 3L8 19l-4 1Z"
    fill="currentColor"
    opacity="0.35"
  />
  <path
    class="tone-ink"
    d="M4 20l1-4L16 5l3 3L8 19l-4 1ZM14 7l3 3"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
    fill="none"
  />
`);

registerIcon("trash", `
  <path
    d="M6 7h12l-1 13H7L6 7Z"
    fill="currentColor"
    opacity="0.35"
  />
  <path
    class="tone-ink"
    d="M4 7h16M9 7V4h6v3M10 11v6M14 11v6"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    fill="none"
  />
`);

registerIcon("file", `
  <path
    d="M6 2h8l5 5v15H6V2Z"
    fill="currentColor"
    opacity="0.35"
  />
  <path
    class="tone-ink"
    d="M14 2v5h5"
    fill="currentColor"
  />
`);
