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

registerIcon("sculpt-paint", svg`
  <path
    class="tone-fill"
    d="M4 20c0-3 2-4 4-4s3 1 3 3-2 3-4 3H4Z"
  />
  <path
    class="tone-ink"
    d="M10 15 20 4M4 20c0-3 2-4 4-4s3 1 3 3-2 3-4 3H4ZM9 14l3 3"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "pink" });

registerIcon("sculpt-holes", svg`
  <path
    class="tone-fill"
    d="M8 15h8v5H8Z"
  />
  <path
    class="tone-ink"
    d="M2 15h6v5h8v-5h6"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    d="M5 9c2-2 4-3 7-3s5 1 7 3"
    fill="none"
    stroke="currentColor"
    stroke-width="1.25"
    stroke-opacity="0.5"
    stroke-linecap="round"
  />
`, { tone: "violet" });

registerIcon("holes-cut", svg`
  <path
    class="tone-fill"
    d="M8 15h8v5H8Z"
  />
  <path
    class="tone-ink"
    d="M2 15h6v5h8v-5h6M12 3v8M9 8l3 3 3-3"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "violet" });

registerIcon("holes-fill", svg`
  <path
    class="tone-fill"
    d="M8 15h8v5H8Z"
  />
  <path
    class="tone-ink"
    d="M2 15h20M12 11V3M9 6l3-3 3 3"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "violet" });

registerIcon("sculpt-chunks", svg`
  <path
    class="tone-fill"
    d="M3 3h9v9H3Z"
  />
  <path
    class="tone-ink"
    d="M3 3h18v18H3ZM12 3v18M3 12h18"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
  />
`, { tone: "teal" });

registerIcon("chunks-add", svg`
  <path
    class="tone-fill"
    d="M3 3h12v12H3Z"
  />
  <path
    class="tone-ink"
    d="M3 3h12v12H3ZM19 14v8M15 18h8"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "teal" });

registerIcon("chunks-remove", svg`
  <path
    class="tone-fill"
    d="M3 3h12v12H3Z"
  />
  <path
    class="tone-ink"
    d="M3 3h12v12H3ZM15 18h8"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "teal" });

registerIcon("chunks-detail", svg`
  <path
    class="tone-fill"
    d="M3 3h18v18H3Z"
  />
  <path
    class="tone-ink"
    d="M3 3h18v18H3ZM9 3v18M15 3v18M3 9h18M3 15h18"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linejoin="round"
  />
`, { tone: "teal" });

registerIcon("sculpt-terrace", svg`
  <path
    class="tone-fill"
    d="M2 20h20v-4h-5v-4h-5V8H7V4H2Z"
  />
  <path
    class="tone-ink"
    d="M2 4h5v4h5v4h5v4h5M2 20h20"
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

registerIcon("flatten-fixed", svg`
  <path
    class="tone-ink"
    d="M3 15h18M12 3v8M9 8l3 3 3-3"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    d="M3 20h18"
    fill="none"
    stroke="currentColor"
    stroke-width="1.25"
    stroke-opacity="0.5"
    stroke-dasharray="2 2"
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
