// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("poi", svg`
  <path
    class="tone-fill"
    d="M3 20l6-11 4 6 2-3 6 8Z"
  />
  <path
    class="tone-ink"
    d="M3 20l6-11 4 6 2-3 6 8ZM15 4v5M15 4l4 1.5-4 1.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "amber" });

registerIcon("poi-add", svg`
  <path
    class="tone-ink"
    d="M12 5v14M5 12h14"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
  />
`, { tone: "amber" });

registerIcon("poi-remove", svg`
  <path
    class="tone-ink"
    d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10.5 10.5v5M13.5 10.5v5"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "coral" });
