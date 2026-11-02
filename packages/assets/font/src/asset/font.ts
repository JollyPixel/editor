// Import Third-party Dependencies
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";

// CONSTANTS
export const FONT_KIND = "font";
export const FONT_COMMAND = "font.command";
export const FONT_EXTENSION = ".typeface.json";
export const FONT_SOURCE_EXTENSIONS = [".ttf", ".otf", ".woff"] as const;

export const FONT_ASSET: AssetKindDescriptor = {
  kind: FONT_KIND,
  label: "Font",
  extension: FONT_EXTENSION,
  creatable: false,
  icon: {
    svg: `
      <rect x="5" y="5" width="54" height="54" rx="6" fill="#2b1d16" />
      <rect x="9" y="9" width="46" height="46" rx="4" fill="#f4e9d8" />
      <path d="M18 48 L29 16 H35 L46 48 H39.5 L37 40.5 H27 L24.5 48 Z M29 34.5 H35 L32 25 Z" fill="#c2452d" />
    `,
    viewBox: "0 0 64 64"
  }
};
