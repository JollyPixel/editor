// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui/icon";

registerIcon("transform-position", svg`
  <path
    d="M12 3v18M3 12h18"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
  />
  <path
    d="m9 6 3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`);

registerIcon("transform-angle", svg`
  <path
    d="M20 12a8 8 0 1 1-2.34-5.66"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
  />
  <path
    d="M20 3v4h-4"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <circle
    cx="12"
    cy="12"
    r="1.75"
    fill="currentColor"
  />
`);

registerIcon("transform-size", svg`
  <rect
    x="3"
    y="9"
    width="12"
    height="12"
    rx="1"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  />
  <path
    d="M13 11l8-8M15 3h6v6"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`);

registerIcon("transform-pivot", svg`
  <circle
    cx="12"
    cy="12"
    r="6"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  />
  <path
    d="M12 2v4M12 18v4M2 12h4M18 12h4"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
  />
  <circle
    cx="12"
    cy="12"
    r="2"
    fill="currentColor"
  />
`);

registerIcon("transform-scale", svg`
  <rect
    x="3"
    y="3"
    width="18"
    height="18"
    rx="1.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-dasharray="3 3"
  />
  <rect
    x="6"
    y="11"
    width="7"
    height="7"
    rx="1"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  />
  <path
    d="M12 12l6-6M14 6h4v4"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`);

registerIcon("transform-local", svg`
  <path
    d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
  />
  <path
    d="M12 12v9M12 12l8-4.5M12 12 4 7.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
  />
`);

registerIcon("transform-global", svg`
  <circle
    cx="12"
    cy="12"
    r="9"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  />
  <path
    d="M3 12h18M12 3c2.5 2.6 3.75 5.6 3.75 9S14.5 18.4 12 21c-2.5-2.6-3.75-5.6-3.75-9S9.5 5.6 12 3Z"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
  />
`);
