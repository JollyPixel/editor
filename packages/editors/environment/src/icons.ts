// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("environment-sun", svg`
  <circle class="tone-fill" cx="12" cy="12" r="4" />
  <circle
    cx="12"
    cy="12"
    r="4"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  />
  <path
    d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
  />
`, { tone: "amber" });
