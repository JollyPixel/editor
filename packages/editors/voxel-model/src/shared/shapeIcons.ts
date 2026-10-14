// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("block", svg`
  <path
    class="tone-fill"
    d="M12 3.5 19.5 7.75 12 12 4.5 7.75 12 3.5Z"
  />
  <path
    d="M12 3.5 19.5 7.75v8.5L12 20.5l-7.5-4.25v-8.5L12 3.5ZM4.5 7.75 12 12l7.5-4.25M12 12v8.5"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linejoin="round"
  />
`, { tone: "sky" });

registerIcon("shape-cylinder", svg`
  <ellipse
    class="tone-fill"
    cx="12"
    cy="6.5"
    rx="7"
    ry="2.5"
  />
  <path
    d="M5 6.5a7 2.5 0 0 1 14 0a7 2.5 0 0 1-14 0v11a7 2.5 0 0 0 14 0v-11"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linejoin="round"
  />
`, { tone: "sky" });

registerIcon("shape-cone", svg`
  <path
    class="tone-fill"
    d="M12 3.5 5 17.5a7 2.5 0 0 0 7 2.5V3.5Z"
  />
  <path
    d="M12 3.5 5 17.5a7 2.5 0 0 0 14 0L12 3.5Z"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linejoin="round"
  />
`, { tone: "sky" });

registerIcon("shape-pyramid", svg`
  <path
    class="tone-fill"
    d="M12 3.5 4 16l8 4.5V3.5Z"
  />
  <path
    d="M12 3.5 4 16l8 4.5 8-4.5-8-12.5Zm0 0v17"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linejoin="round"
  />
`, { tone: "sky" });

registerIcon("shape-torus", svg`
  <path
    class="tone-fill"
    fill-rule="evenodd"
    stroke="currentColor"
    stroke-width="1.5"
    d="M3 12a9 5 0 1 0 18 0a9 5 0 1 0-18 0ZM8.5 11.5a3.5 1.75 0 1 0 7 0a3.5 1.75 0 1 0-7 0Z"
  />
`, { tone: "sky" });

registerIcon("shape-plane", svg`
  <path
    class="tone-fill"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linejoin="round"
    d="M12 7.5 21 12l-9 4.5L3 12l9-4.5Z"
  />
`, { tone: "sky" });
