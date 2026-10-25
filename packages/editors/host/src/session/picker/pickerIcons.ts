// Import Third-party Dependencies
import {
  registerIcon,
  type IconName
} from "@jolly-pixel/ui";

// CONSTANTS
export const PICKER_FOLDER_ICON: IconName = "asset-folder";

registerIcon(PICKER_FOLDER_ICON, `
  <path
    class="tone-fill"
    d="M4 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linejoin="round"
  />
`, {
  tone: "amber"
});
