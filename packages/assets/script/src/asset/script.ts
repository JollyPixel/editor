// Import Third-party Dependencies
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";

// CONSTANTS
export const SCRIPT_KIND = "script";
export const SCRIPT_COMMAND = "script.command";
export const SCRIPT_EXTENSION = ".ts";
export const SCRIPT_CONTENT_TYPES = {
  ".ts": "text/typescript",
  ".js": "text/javascript"
} as const;

export const SCRIPT_TEMPLATE = `import { Behavior, SceneProperty } from "@jolly-pixel/engine";

export class NewBehavior extends Behavior {
  @SceneProperty({ type: "number" })
  speed = 1;

  update() {
  }
}
`;

export const SCRIPT_ASSET: AssetKindDescriptor = {
  kind: SCRIPT_KIND,
  label: "Script",
  extension: SCRIPT_EXTENSION,
  icon: {
    svg: `
      <rect x="5" y="5" width="54" height="54" rx="6" fill="#172033" />
      <rect x="9" y="9" width="46" height="46" rx="4" fill="#e6ecf7" />
      <path
        d="M25 22 L15 32 L25 42 M39 22 L49 32 L39 42"
        fill="none" stroke="#2f6fd6" stroke-width="4"
        stroke-linecap="round" stroke-linejoin="round"
      />
      <path d="M35 18 L29 46" stroke="#d9822b" stroke-width="4" stroke-linecap="round" />
    `,
    viewBox: "0 0 64 64"
  }
};
