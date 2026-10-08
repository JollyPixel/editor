// Import Third-party Dependencies
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("folder", `
  <path d="M6 15 a3 3 0 0 1 3 -3 H23 L28 17 H55 a3 3 0 0 1 3 3 V52 a3 3 0 0 1 -3 3 H9 a3 3 0 0 1 -3 -3 Z" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
  <rect x="6" y="25" width="52" height="30" rx="3" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
  <path d="M6 15 a3 3 0 0 1 3 -3 H23 L28 17 H55 a3 3 0 0 1 3 3 V52 a3 3 0 0 1 -3 3 H9 a3 3 0 0 1 -3 -3 Z" fill="#e39a1b" />
  <rect x="6" y="25" width="52" height="30" rx="3" fill="#ffc93c" />
`, { viewBox: "0 0 64 64" });

registerIcon("new-folder", `
  <g transform="translate(1 1) scale(.8)">
    <path d="M6 15 a3 3 0 0 1 3 -3 H23 L28 17 H55 a3 3 0 0 1 3 3 V52 a3 3 0 0 1 -3 3 H9 a3 3 0 0 1 -3 -3 Z" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
    <rect x="6" y="25" width="52" height="30" rx="3" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
    <path d="M6 15 a3 3 0 0 1 3 -3 H23 L28 17 H55 a3 3 0 0 1 3 3 V52 a3 3 0 0 1 -3 3 H9 a3 3 0 0 1 -3 -3 Z" fill="#e39a1b" />
    <rect x="6" y="25" width="52" height="30" rx="3" fill="#ffc93c" />
  </g>
  <circle cx="50" cy="50" r="11" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
  <circle cx="50" cy="50" r="11" fill="#4cc35b" />
  <path d="M50 44 V56 M44 50 H56" stroke="#ffffff" stroke-width="3.6" stroke-linecap="round" />
`, { viewBox: "0 0 64 64" });

registerIcon("pencil", `
  <path
    d="M4 20l1-4L16 5l3 3L8 19l-4 1Z"
    fill="currentColor"
    opacity="0.35"
  />
  <path
    class="tone-ink"
    d="M4 20l1-4L16 5l3 3L8 19l-4 1ZM14 7l3 3"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
    fill="none"
  />
`);

registerIcon("trash", `
  <path
    d="M6 7h12l-1 13H7L6 7Z"
    fill="currentColor"
    opacity="0.35"
  />
  <path
    class="tone-ink"
    d="M4 7h16M9 7V4h6v3M10 11v6M14 11v6"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    fill="none"
  />
`);

registerIcon("file", `
  <path d="M14 5 H39 L51 17 V59 H14 Z" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
  <path d="M14 5 H39 L51 17 V59 H14 Z" fill="#8fd8ff" />
  <path d="M39 5 V17 H51 Z" fill="#d6f1ff" />
`, { viewBox: "0 0 64 64" });

registerIcon("home", `
  <path
    d="M5 11v9h5v-6h4v6h5v-9"
    fill="currentColor"
    opacity="0.35"
  />
  <path
    class="tone-ink"
    d="M3 12l9-8 9 8M5 11v9h5v-6h4v6h5v-9"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
    stroke-linecap="round"
    fill="none"
  />
`);

registerIcon("sign-out", `
  <path
    d="M4 4h8v16H4Z"
    fill="currentColor"
    opacity="0.35"
  />
  <path
    class="tone-ink"
    d="M12 4H4v16h8M10 12h10M16 8l4 4-4 4"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
  />
`);

registerIcon("export", `
  <path
    d="M4 15v5h16v-5"
    fill="currentColor"
    opacity="0.35"
  />
  <path
    class="tone-ink"
    d="M12 4v11M7 10l5 5 5-5M4 15v5h16v-5"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
  />
`, { tone: "sky" });

registerIcon("all-kinds", `
  <g transform="translate(10 -2) scale(.86)">
    <path d="M14 5 H39 L51 17 V59 H14 Z" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
    <path d="M14 5 H39 L51 17 V59 H14 Z" fill="#c79bff" />
    <path d="M39 5 V17 H51 Z" fill="#ecdcff" />
  </g>
  <g transform="translate(1 8) scale(.86)">
    <path d="M14 5 H39 L51 17 V59 H14 Z" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
    <path d="M14 5 H39 L51 17 V59 H14 Z" fill="#8fd8ff" />
    <path d="M39 5 V17 H51 Z" fill="#d6f1ff" />
  </g>
`, { viewBox: "0 0 64 64" });
