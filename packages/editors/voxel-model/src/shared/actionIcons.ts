// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

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
  <path
    d="M10 11v6M14 11v6"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
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
  <path
    d="M13 7l4 4"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
  />
`, { tone: "teal" });

registerIcon("material", svg`
  <circle
    class="tone-fill"
    cx="12"
    cy="12"
    r="9"
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
    d="M7.5 10a5 5 0 0 1 4-4"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
  />
`, { tone: "violet" });

registerIcon("folder", svg`
  <path
    class="tone-fill"
    d="M4 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linejoin="round"
  />
`, { tone: "amber" });

registerIcon("folder-add", svg`
  <path
    class="tone-fill"
    d="M4 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linejoin="round"
  />
  <path
    d="M12 11v5M9.5 13.5h5"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
  />
`, { tone: "amber" });
