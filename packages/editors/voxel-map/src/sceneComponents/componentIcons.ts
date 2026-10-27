// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

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
