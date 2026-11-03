// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("sound-wave", svg`
  <path
    class="tone-ink"
    d="M2 12h3l2-5 3 11 3-14 3 12 2-6 1 2h3"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "teal" });

registerIcon("sound-play", svg`
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

registerIcon("sound-pause", svg`
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

registerIcon("sound-loop", svg`
  <path
    d="M9 17H7.5a4.5 4.5 0 0 1 0-9h9a4.5 4.5 0 0 1 0 9H12M14.5 14.5 12 17l2.5 2.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "sky" });

registerIcon("sound-drive", svg`
  <path
    class="tone-fill"
    d="M4 17 3 7l5 4 4-6 4 6 5-4-1 10z"
  />
  <path
    d="M4 17 3 7l5 4 4-6 4 6 5-4-1 10zM5 20.5h14"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "amber" });

registerIcon("sound-listen", svg`
  <rect
    class="tone-fill"
    x="3"
    y="14"
    width="5"
    height="7"
    rx="2"
  />
  <rect
    class="tone-fill"
    x="16"
    y="14"
    width="5"
    height="7"
    rx="2"
  />
  <path
    d="M4 15v-3a8 8 0 0 1 16 0v3"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
  />
  <rect
    x="3"
    y="14"
    width="5"
    height="7"
    rx="2"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  />
  <rect
    x="16"
    y="14"
    width="5"
    height="7"
    rx="2"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  />
`, { tone: "violet" });

registerIcon("sound-import", svg`
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

registerIcon("sound-export", svg`
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

registerIcon("sound-backward", svg`
  <path
    class="tone-ink"
    d="M20 12H5M9 8l-4 4 4 4"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "pink" });

registerIcon("sound-forward", svg`
  <path
    class="tone-ink"
    d="M4 12h15M15 8l4 4-4 4"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "lime" });

registerIcon("sound-volume", svg`
  <path
    class="tone-fill"
    d="M4 9h3l5-4v14l-5-4H4z"
  />
  <path
    d="M4 9h3l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "teal" });
