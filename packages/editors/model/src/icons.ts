// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("model-cube", svg`
  <path
    class="tone-fill"
    d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"
  />
  <path
    d="M12 3 20 7.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
  />
`, { tone: "sky" });

registerIcon("model-animate", svg`
  <path
    class="tone-fill"
    d="M10 8.5v7l6-3.5-6-3.5Z"
  />
  <circle
    cx="12"
    cy="12"
    r="9"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  />
  <path
    d="M10 8.5v7l6-3.5-6-3.5Z"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
  />
`, { tone: "lime" });

registerIcon("model-stop", svg`
  <rect
    class="tone-fill"
    x="6"
    y="6"
    width="12"
    height="12"
    rx="1.5"
  />
  <rect
    x="6"
    y="6"
    width="12"
    height="12"
    rx="1.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  />
`, { tone: "coral" });
registerIcon("model-play", svg`
  <path
    class="tone-fill"
    d="M7 4.5v15l12-7.5z"
  />
  <path
    d="M7 4.5v15l12-7.5z"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
  />
`, { tone: "lime" });

registerIcon("model-pause", svg`
  <rect
    class="tone-fill"
    x="6"
    y="5"
    width="4"
    height="14"
    rx="1"
  />
  <rect
    class="tone-fill"
    x="14"
    y="5"
    width="4"
    height="14"
    rx="1"
  />
  <path
    d="M7 5h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  />
  <path
    d="M15 5h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  />
`, { tone: "coral" });

registerIcon("model-loop", svg`
  <path
    d="M9 17H7.5a4.5 4.5 0 0 1 0-9h9a4.5 4.5 0 0 1 0 9H12M14.5 14.5 12 17l2.5 2.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "sky" });
registerIcon("model-import", svg`
  <path
    class="tone-ink"
    d="M12 4v11M7.5 10.5 12 15l4.5-4.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "lime" });

registerIcon("model-export", svg`
  <path
    class="tone-ink"
    d="M12 15V4M7.5 8.5 12 4l4.5 4.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "sky" });
