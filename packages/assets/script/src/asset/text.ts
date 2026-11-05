// Import Third-party Dependencies
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";

// CONSTANTS
export const TEXT_KIND = "text";
export const TEXT_COMMAND = "text.command";
export const TEXT_EXTENSION = ".md";
export const TEXT_CONTENT_TYPES = {
  ".md": "text/markdown",
  ".txt": "text/plain",
  ".json": "application/json",
  ".jsonc": "application/json",
  ".yml": "application/yaml",
  ".yaml": "application/yaml",
  ".toml": "application/toml",
  ".xml": "application/xml",
  ".html": "text/html",
  ".css": "text/css"
} as const;

export const TEXT_ASSET: AssetKindDescriptor = {
  kind: TEXT_KIND,
  label: "Text",
  extension: TEXT_EXTENSION,
  icon: {
    svg: `
      <path
        d="M14 5 H40 L52 17 V59 H14 Z"
        fill="#e6ecf7" stroke="#172033" stroke-width="3" stroke-linejoin="round"
      />
      <path
        d="M40 5 V17 H52"
        fill="none" stroke="#172033" stroke-width="3" stroke-linejoin="round"
      />
      <path
        d="M21 28 H45 M21 36 H45 M21 44 H37"
        fill="none" stroke="#2f6fd6" stroke-width="4" stroke-linecap="round"
      />
    `,
    viewBox: "0 0 64 64"
  }
};
