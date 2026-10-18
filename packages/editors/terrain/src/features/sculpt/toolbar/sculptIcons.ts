// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("sculpt-raise", svg`
  <path
    class="tone-fill"
    d="M2 20c3 0 5-9 10-9s7 9 10 9Z"
  />
  <path
    class="tone-ink"
    d="M2 20c3 0 5-9 10-9s7 9 10 9M12 8V2M9 5l3-3 3 3"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "lime" });

registerIcon("sculpt-smooth", svg`
  <path
    d="M2 16l3-5 3 6 3-8 3 7 3-4 3 5 2-2"
    fill="none"
    stroke="currentColor"
    stroke-width="1.25"
    stroke-opacity="0.5"
    stroke-linejoin="round"
  />
  <path
    class="tone-ink"
    d="M2 15c4-3 6-3 10 0s6 3 10 0"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
  />
`, { tone: "sky" });

registerIcon("sculpt-flatten", svg`
  <path
    class="tone-fill"
    d="M2 20c2 0 3-6 6-6h8c3 0 4 6 6 6Z"
  />
  <path
    class="tone-ink"
    d="M2 20c2 0 3-6 6-6h8c3 0 4 6 6 6M5 9h14"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "amber" });

for (const [curve, profile] of [
  ["smooth", "M3 6C10 6 14 19 21 19"],
  ["linear", "M3 6 21 19"],
  ["sphere", "M3 6A18 13 0 0 1 21 19"],
  ["sharp", "M3 6Q6 19 21 19"],
  ["constant", "M3 6H21V19"]
] as const) {
  registerIcon(`falloff-${curve}`, svg`
    <path
      d="M3 21H21"
      fill="none"
      stroke="currentColor"
      stroke-width="1.25"
      stroke-opacity="0.5"
    />
    <path
      class="tone-ink"
      d=${profile}
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  `, { tone: "amber" });
}
