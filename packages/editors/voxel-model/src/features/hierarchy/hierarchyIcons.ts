// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

// Import Internal Dependencies
import "../../shared/shapeIcons.ts";

// CONSTANTS
const kViewBox = "0 0 64 64";
const kFolder = svg`
  <path d="M6 15 a3 3 0 0 1 3 -3 H23 L28 17 H55 a3 3 0 0 1 3 3 V52 a3 3 0 0 1 -3 3 H9 a3 3 0 0 1 -3 -3 Z" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
  <rect x="6" y="25" width="52" height="30" rx="3" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
  <path d="M6 15 a3 3 0 0 1 3 -3 H23 L28 17 H55 a3 3 0 0 1 3 3 V52 a3 3 0 0 1 -3 3 H9 a3 3 0 0 1 -3 -3 Z" fill="#e39a1b" />
  <rect x="6" y="25" width="52" height="30" rx="3" fill="#ffc93c" />
`;

registerIcon("hierarchy-folder", kFolder, { viewBox: kViewBox });

registerIcon("folder-add", svg`
  <g transform="translate(1 1) scale(.8)">${kFolder}</g>
  <circle cx="50" cy="50" r="11" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
  <circle cx="50" cy="50" r="11" fill="#4cc35b" />
  <path d="M50 44 V56 M44 50 H56" stroke="#ffffff" stroke-width="3.6" stroke-linecap="round" />
`, { viewBox: kViewBox });
