// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

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

registerIcon("sound-stop", svg`
  <rect
    class="tone-fill"
    x="5.5"
    y="5.5"
    width="13"
    height="13"
    rx="1.5"
  />
  <rect
    x="5.5"
    y="5.5"
    width="13"
    height="13"
    rx="1.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  />
`, { tone: "coral" });

registerIcon("sound-loop", svg`
  <path
    d="M4 11V9a3 3 0 0 1 3-3h12M16 3l3 3-3 3M20 13v2a3 3 0 0 1-3 3H5M8 21l-3-3 3-3"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "sky" });
