// Import Third-party Dependencies
import { svg } from "lit";

// Import Internal Dependencies
import { registerIcon } from "./registry.ts";

/**
 * Registers built-in chrome glyphs on the shared 24px grid.
 */
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

registerIcon("close", svg`
  <path
    d="M6 6l12 12M18 6 6 18"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linecap="round"
  />
`);

// Circular reset arrow.
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

// Horizontal drag affordance.
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

// Description indicator.
registerIcon("info", svg`
  <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.25" />
  <path d="M12 11v5.5" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" />
  <circle cx="12" cy="7.75" r="1.2" fill="currentColor" stroke="none" />
`);

// Error indicator.
registerIcon("warning", svg`
  <path
    d="M12 4.25 21.5 20.5h-19Z"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linejoin="round"
  />
  <path d="M12 10v4.25" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" />
  <circle cx="12" cy="17.25" r="1.2" fill="currentColor" stroke="none" />
`);
