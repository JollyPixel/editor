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
  <path
    class="tone-fill"
    d="M7 16a5 5 0 0 1 10 0Z"
  />
  <path
    d="M7 16a5 5 0 0 1 10 0M3 16h18M7 20h10M12 4v3M4.9 8.9 7 11M19.1 8.9 17 11"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "teal" });

registerIcon("actor-empty", svg`
  <rect
    x="4"
    y="4"
    width="16"
    height="16"
    rx="4"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
  />
  <circle
    class="tone-fill"
    cx="12"
    cy="12"
    r="2.5"
    stroke="currentColor"
    stroke-width="1.75"
  />
`, { tone: "violet" });

registerIcon("actor-prefab", svg`
  <path
    class="tone-fill"
    d="M3 6h18v4H3Z"
  />
  <path
    d="M3 6h18v4H3ZM3 10h18v8.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5ZM8 6l-2 4M13 6l-2 4M18 6l-2 4"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "coral" });

registerIcon("actor-anchor", svg`
  <path
    class="tone-fill"
    d="M9.5 3h5v5.5l3 3.5h-11l3-3.5Z"
  />
  <path
    d="M8 3h8M9.5 3v5.5l-3 3.5h11l-3-3.5V3M12 12v9"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "teal" });

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
  <path
    class="tone-fill"
    d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2v.5h5V16c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3Z"
  />
  <path
    d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2v.5h5V16c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3ZM9.5 19h5M10.5 21.5h3"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
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

registerIcon("actor-rigid-body", svg`
  <circle
    class="tone-fill"
    cx="12"
    cy="10"
    r="6"
    stroke="currentColor"
    stroke-width="2"
  />
  <path
    d="M3 20h18"
    fill="none"
    stroke="currentColor"
    stroke-width="2.4"
    stroke-linecap="round"
  />
`, { tone: "coral" });

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

registerIcon("tree-options", svg`
  <circle cx="5" cy="12" r="2" fill="currentColor" />
  <circle cx="12" cy="12" r="2" fill="currentColor" />
  <circle cx="19" cy="12" r="2" fill="currentColor" />
`);

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
  <circle
    class="tone-fill"
    cx="12"
    cy="12"
    r="2.5"
    stroke="currentColor"
    stroke-width="1.75"
  />
  <path
    d="M12 4a8 8 0 1 0 8 8M9.5 1.5 12 4l-2.5 2.5"
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
    rx="1.5"
    stroke="currentColor"
    stroke-width="1.75"
  />
  <path
    d="M4 9V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-dasharray="2.5 2.2"
  />
  <path
    d="M12 12l5-5M13 7h4v4"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "coral" });

registerIcon("gizmo-space-local", svg`
  <rect
    class="tone-fill"
    x="4"
    y="4"
    width="16"
    height="16"
    rx="3"
    stroke="currentColor"
    stroke-width="1.75"
  />
  <path
    d="M10 8v8h5"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "amber" });

registerIcon("gizmo-space-world", svg`
  <rect
    class="tone-fill"
    x="4"
    y="4"
    width="16"
    height="16"
    rx="3"
    stroke="currentColor"
    stroke-width="1.75"
  />
  <path
    d="M7.5 8l1.75 8L12 10.5 14.75 16 16.5 8"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "teal" });

registerIcon("view-grid", svg`
  <rect
    class="tone-fill"
    x="3"
    y="3"
    width="18"
    height="18"
    rx="3"
  />
  <path
    d="M5 5h0M12 5h0M19 5h0M5 12h0M12 12h0M19 12h0M5 19h0M12 19h0M19 19h0"
    fill="none"
    stroke="currentColor"
    stroke-width="3.2"
    stroke-linecap="round"
  />
`, { tone: "amber" });

registerIcon("view-axes", svg`
  <path
    class="tone-fill"
    d="M10 4a2 2 0 1 0 4 0 2 2 0 1 0-4 0M17.5 17.5a2 2 0 1 0 4 0 2 2 0 1 0-4 0M2.5 17.5a2 2 0 1 0 4 0 2 2 0 1 0-4 0"
    stroke="currentColor"
    stroke-width="1.75"
  />
  <path
    d="M12 13V6M12 13l5.8 3.4M12 13l-5.8 3.4"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <circle
    cx="12"
    cy="13"
    r="1.3"
    fill="currentColor"
  />
`, { tone: "coral" });

registerIcon("view-snap", svg`
  <g transform="rotate(-45 12 12)">
    <path
      class="tone-fill"
      d="M5 4h4v4H5zM15 4h4v4h-4z"
    />
    <path
      d="M5 4h4v8a3 3 0 0 0 6 0V4h4v8a7 7 0 0 1-14 0ZM5 8h4M15 8h4"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </g>
`, { tone: "amber" });

registerIcon("view-frame", svg`
  <circle
    class="tone-fill"
    cx="12"
    cy="12"
    r="3.5"
  />
  <path
    d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4M15.5 12a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "violet" });
