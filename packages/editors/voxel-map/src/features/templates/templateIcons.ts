/* eslint-disable @stylistic/max-len */
// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("eye-off", svg`
  <path
    d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linejoin="round"
  />
  <path d="M4 20 20 4" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" />
`);

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
