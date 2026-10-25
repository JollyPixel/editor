// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("scene-hierarchy", svg`
  <path
    class="tone-fill"
    d="M4 3h7v5H4zM13 16h7v5h-7z"
  />
  <path
    d="M4 3h7v5H4zM13 9.5h7v5h-7zM13 16h7v5h-7zM7.5 8v10.5H13M7.5 12H13"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "violet" });

registerIcon("scene-inspector", svg`
  <rect
    class="tone-fill"
    x="4"
    y="3"
    width="16"
    height="18"
    rx="2"
  />
  <path
    d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM8 8h8M8 12h8M8 16h5"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
  />
`, { tone: "sky" });

registerIcon("scene-environment", svg`
  <circle
    class="tone-fill"
    cx="12"
    cy="12"
    r="9"
  />
  <path
    d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9M12 3C9.5 5.5 8.5 8.5 8.5 12s1 6.5 3.5 9"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
  />
`, { tone: "teal" });

registerIcon("actor-empty", svg`
  <path
    d="M12 3v18M3 12h18"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
  />
  <circle
    class="tone-fill"
    cx="12"
    cy="12"
    r="3"
    stroke="currentColor"
    stroke-width="1.5"
  />
`, { tone: "violet" });

registerIcon("actor-camera", svg`
  <rect
    class="tone-fill"
    x="3"
    y="7"
    width="12"
    height="10"
    rx="2"
    stroke="currentColor"
    stroke-width="1.75"
  />
  <path
    d="m15 11 6-3v8l-6-3"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linejoin="round"
  />
`, { tone: "sky" });

registerIcon("actor-light", svg`
  <circle
    class="tone-fill"
    cx="12"
    cy="12"
    r="4"
    stroke="currentColor"
    stroke-width="1.75"
  />
  <path
    d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
  />
`, { tone: "amber" });

registerIcon("actor-mesh", svg`
  <path
    class="tone-fill"
    d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z"
  />
  <path
    d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3ZM4 7.5l8 4.5 8-4.5M12 12v9"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linejoin="round"
  />
`, { tone: "lime" });

registerIcon("actor-voxel-map", svg`
  <path
    class="tone-fill"
    d="M3 14h6v6H3zM9 8h6v6H9z"
  />
  <path
    d="M3 14h6v6H3zM9 14h6v6H9zM15 14h6v6h-6zM9 8h6v6H9z"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linejoin="round"
  />
`, { tone: "lime" });

registerIcon("action-duplicate", svg`
  <rect
    class="tone-fill"
    x="9"
    y="9"
    width="12"
    height="12"
    rx="2"
    stroke="currentColor"
    stroke-width="1.5"
  />
  <path
    d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "sky" });

registerIcon("action-delete", svg`
  <path
    class="tone-fill"
    d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13z"
  />
  <path
    d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "coral" });

registerIcon("action-rename", svg`
  <path
    class="tone-fill"
    d="M15 5l4 4L9 19H5v-4L15 5Z"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linejoin="round"
  />
`, { tone: "teal" });

registerIcon("undo", svg`
  <path class="tone-ink" d="M8.5 4 3 9l5.5 5Z" fill="currentColor" />
  <path
    class="tone-ink"
    d="M7 9h7.5a5 5 0 0 1 0 10H10"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "teal" });

registerIcon("redo", svg`
  <path class="tone-ink" d="M15.5 4 21 9l-5.5 5Z" fill="currentColor" />
  <path
    class="tone-ink"
    d="M17 9H9.5a5 5 0 0 0 0 10H14"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "teal" });

registerIcon("gizmo-translate", svg`
  <path
    d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "sky" });

registerIcon("gizmo-rotate", svg`
  <path
    d="M20 12a8 8 0 1 1-2.34-5.66M20 4v4h-4"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "lime" });

registerIcon("gizmo-scale", svg`
  <rect
    class="tone-fill"
    x="4"
    y="12"
    width="8"
    height="8"
    rx="1"
  />
  <path
    d="M4 12h8v8H4zM14 4h6v6M20 4l-8 8"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "coral" });

registerIcon("move-up", svg`
  <path
    d="M12 19V5M6 11l6-6 6 6"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "sky" });

registerIcon("move-down", svg`
  <path
    d="M12 5v14M6 13l6 6 6-6"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "sky" });
