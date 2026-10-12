// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("version-save", svg`
  <path
    class="tone-ink"
    fill="currentColor"
    fill-rule="evenodd"
    d="M5 3h11l5 5v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM7.5 5v4h8V5ZM7 13v6h10v-6Z"
  />
`, { tone: "sky" });

registerIcon("version-delete", svg`
  <path
    class="tone-ink"
    fill="currentColor"
    fill-rule="evenodd"
    d="M9 2.5h6v2h5V7H4V4.5h5ZM5.5 8.5h13L17.4 21H6.6ZM9.5 11v7.5h1.8V11ZM12.7 11v7.5h1.8V11Z"
  />
`, { tone: "coral" });
