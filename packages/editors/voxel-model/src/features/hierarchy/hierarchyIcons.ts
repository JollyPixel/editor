// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

// Import Internal Dependencies
import "../../shared/shapeIcons.ts";

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
  <mask id="folder-add-badge-cut">
    <rect width="24" height="24" fill="#fff" />
    <circle cx="18" cy="17.5" r="5.75" fill="#000" />
  </mask>
  <path
    d="M2.5 6.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
    mask="url(#folder-add-badge-cut)"
  />
  <path
    class="tone-ink"
    d="M18 14v7M14.5 17.5h7"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linecap="round"
  />
`, { tone: "lime" });
