// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("actor-voxel-model", svg`
  <path
    class="tone-fill"
    d="M9 3h6v6H9zM7 10h10v7H7z"
  />
  <path
    d="M9 3h6v6H9zM7 10h10v7H7zM8 17v4h3v-4M13 17v4h3v-4"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linejoin="round"
  />
`, { tone: "amber" });
