/* eslint-disable @stylistic/max-len */
// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

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

registerIcon("block-duplicate", svg`
  <rect
    class="tone-ink"
    x="9"
    y="9"
    width="12"
    height="12"
    rx="2"
    fill="currentColor"
    fill-opacity="0.4"
    stroke="currentColor"
    stroke-width="2.2"
  />
  <path
    class="tone-ink"
    d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
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
