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

registerIcon("help", svg`
  <path
    class="tone-ink"
    fill="currentColor"
    d="M12 3c-3.3 0-5.8 2.1-5.8 5.2h3.2c0-1.4 1.1-2.3 2.6-2.3s2.6.8 2.6 2.1c0 1-.6 1.6-1.8 2.3-1.6 1-2.4 2-2.4 4v.7h3.1v-.5c0-1 .4-1.5 1.7-2.3 1.7-1.1 2.6-2.3 2.6-4.3C17.8 4.9 15.3 3 12 3ZM10.4 17.3h3.3V21h-3.3Z"
  />
`, { tone: "sky" });

registerIcon("offline", svg`
  <path
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
    d="M7 18.5h10.5a3.5 3.5 0 0 0 .4-7A5.5 5.5 0 0 0 7.4 9.6 4.5 4.5 0 0 0 7 18.5Z"
  />
  <path
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    d="M4 4l16 16"
  />
`);
