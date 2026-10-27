// Import Third-party Dependencies
import { svg } from "lit";

// Import Internal Dependencies
import { registerIcon } from "./registry.ts";

registerIcon("chevron", svg`
  <path
    d="M8.5 5.5 16 12l-7.5 6.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`);

registerIcon("settings", svg`
  <path
    d="M4 8h16M4 16h16"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linecap="round"
  />
  <circle cx="9" cy="8" r="3" fill="currentColor" />
  <circle cx="15" cy="16" r="3" fill="currentColor" />
`);

registerIcon("close", svg`
  <path
    d="M6 6l12 12M18 6 6 18"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linecap="round"
  />
`);

registerIcon("plus", svg`
  <path
    class="tone-ink"
    d="M12 5v14M5 12h14"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linecap="round"
  />
`, { tone: "lime" });

registerIcon("revert", svg`
  <path
    d="M3 12a9 9 0 1 0 3-6.7L3 8"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    d="M3 3v5h5"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`);

registerIcon("drag", svg`
  <path
    d="M3 12h18"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linecap="round"
  />
  <path
    d="M6.5 8.5 3 12l3.5 3.5M17.5 8.5 21 12l-3.5 3.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`);

registerIcon("lock", svg`
  <rect
    x="4.5"
    y="10.5"
    width="15"
    height="10"
    rx="2"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linejoin="round"
  />
  <path
    d="M8 10.5V7.5a4 4 0 0 1 8 0v3"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linecap="round"
  />
`);

registerIcon("eye", svg`
  <path
    d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linejoin="round"
    stroke-linecap="round"
  />
  <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="2.25" />
`);

registerIcon("search", svg`
  <circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="2.25" />
  <path
    d="m15 15 4.5 4.5"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linecap="round"
  />
`);

registerIcon("folder", svg`
  <path
    d="M4 7.5a2 2 0 0 1 2-2h3.5l2 2H18a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linejoin="round"
  />
`);

registerIcon("check", svg`
  <path
    d="m5 12.5 4.5 4.5L19 7"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`);

registerIcon("info", svg`
  <circle cx="12" cy="12" r="9" fill="currentColor" />
  <path
    d="M12 10.5v6"
    fill="none"
    stroke="var(--jolly-surface, Canvas)"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <circle cx="12" cy="7.5" r="1.35" fill="var(--jolly-surface, Canvas)" />
`);

registerIcon("warning", svg`
  <path
    d="M12 4.25 21.5 20.5h-19Z"
    fill="currentColor"
  />
  <path
    d="M12 9.75v4.75"
    fill="none"
    stroke="var(--jolly-surface, Canvas)"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <circle cx="12" cy="17.4" r="1.35" fill="var(--jolly-surface, Canvas)" />
`);

registerIcon("trash", svg`
  <path
    class="tone-ink"
    d="M4 7h16"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
  />
  <path
    class="tone-ink"
    d="M9 7V4.8c0-.44.36-.8.8-.8h4.4c.44 0 .8.36.8.8V7"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linejoin="round"
  />
  <path
    class="tone-ink"
    d="M6.5 7 7.3 19.2a2 2 0 0 0 2 1.8h5.4a2 2 0 0 0 2-1.8L17.5 7"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linejoin="round"
    stroke-linecap="round"
  />
  <path
    class="tone-ink"
    d="M10 11v6M14 11v6"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
  />
`, { tone: "coral" });
