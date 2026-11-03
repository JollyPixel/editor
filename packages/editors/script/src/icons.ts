// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("script-code", svg`
  <path
    class="tone-ink"
    d="M8 7 3 12l5 5M16 7l5 5-5 5"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    d="M13.5 5 10.5 19"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
  />
`, { tone: "sky" });

registerIcon("script-outline", svg`
  <path
    class="tone-ink"
    d="M5 6h14M9 12h10M9 18h10"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
  />
  <circle class="tone-fill" cx="5" cy="12" r="1.5" />
  <circle class="tone-fill" cx="5" cy="18" r="1.5" />
`, { tone: "amber" });
