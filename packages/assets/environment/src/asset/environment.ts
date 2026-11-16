// Import Third-party Dependencies
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";
import { Systems } from "@jolly-pixel/engine/core";

// Import Internal Dependencies
import type { EnvironmentFile } from "../network/types.ts";

// CONSTANTS
export const ENVIRONMENT_KIND = "environment";
export const ENVIRONMENT_COMMAND = "environment.command";
export const ENVIRONMENT_EXTENSION = ".environment.json";

export const ENVIRONMENT_ASSET: AssetKindDescriptor = {
  kind: ENVIRONMENT_KIND,
  label: "Environment",
  extension: ENVIRONMENT_EXTENSION,
  icon: {
    svg: `
      <rect x="5" y="5" width="54" height="54" rx="6" fill="#1b2433" />
      <rect x="9" y="9" width="46" height="46" rx="4" fill="#9cc9f0" />
      <circle cx="40" cy="24" r="8" fill="#ffd23f" />
      <path
        d="M9 44 Q22 32 34 42 T55 38 V51 Q55 55 51 55 H13 Q9 55 9 51 Z"
        fill="#4f9a5a"
      />
      <path
        d="M9 50 Q26 42 55 48 V51 Q55 55 51 55 H13 Q9 55 9 51 Z"
        fill="#3a7646"
      />
    `,
    viewBox: "0 0 64 64"
  }
};

export function createEnvironmentFile(): EnvironmentFile {
  return structuredClone(Systems.ENVIRONMENT_PRESETS.default);
}
