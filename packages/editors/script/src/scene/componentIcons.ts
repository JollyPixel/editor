// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("actor-script", svg`
  <rect
    class="tone-fill"
    x="4"
    y="4"
    width="16"
    height="16"
    rx="2"
  />
  <path
    d="M10 9 7 12l3 3M14 9l3 3-3 3"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <rect
    x="4"
    y="4"
    width="16"
    height="16"
    rx="2"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
  />
`, { tone: "sky" });
