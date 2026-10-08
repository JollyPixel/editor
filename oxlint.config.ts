// Import Third-party Dependencies
import { defineConfig } from "oxlint";
import { typescriptConfig } from "@openally/config.oxlint";

// CONSTANTS
const kNoCommentsWorkspaces = [
  "accounts",
  "assets/voxel-animation",
  "e2e",
  "image"
];
const kNoOfNamesWorkspaces = [
  "accounts",
  "arbor",
  "bench",
  "editors/pixel-art",
  "event-store",
  "resize-handle",
  "voxel-tiled"
];
const kNoGetSetPrefixWorkspaces = [
  "accounts",
  "asset",
  "asset-server",
  "asset-source",
  "bench",
  "color",
  "console",
  "e2e",
  "editors/host",
  "event-store",
  "history",
  "resize-handle",
  "studio"
];

function workspaceGlobs(
  workspaces: string[]
): string[] {
  return workspaces.map((workspace) => `packages/${workspace}/**`);
}

export default defineConfig(typescriptConfig({
  ignorePatterns: [
    "**/coverage/**",
    "**/generated/**"
  ],
  env: {
    browser: true
  },
  plugins: ["unicorn"],
  jsPlugins: [
    {
      name: "@jolly-pixel",
      specifier: new URL("./scripts/oxlint/plugin.ts", import.meta.url).href
    }
  ],
  rules: {
    "@stylistic/no-mixed-operators": "off",
    "max-params": [
      "error", { max: 5 }
    ],
    "unicorn/no-new-array": "error",
    "typescript/parameter-properties": "error",
    "typescript/no-namespace": "error",
    "@jolly-pixel/comment-format": "error",
    "@jolly-pixel/err-declared-error": "error",
    "@jolly-pixel/no-enum": "error",
    "@jolly-pixel/no-ts-private": "error"
  },
  overrides: [
    {
      files: ["**/test/**", "**/bench/**"],
      rules: {
        "max-classes-per-file": "off"
      }
    },
    {
      files: ["**/*.spec.ts", "**/*.test.ts"],
      rules: {
        "max-lines": [
          "warn", { max: 300 }
        ]
      }
    },
    {
      files: ["packages/*/src/**", "packages/*/*/src/**"],
      rules: {
        "@jolly-pixel/errors-in-errors-folder": "error"
      }
    },
    {
      files: workspaceGlobs(kNoCommentsWorkspaces),
      rules: {
        "@jolly-pixel/no-comments": "error"
      }
    },
    {
      files: workspaceGlobs(kNoOfNamesWorkspaces),
      rules: {
        "@jolly-pixel/no-of-names": "error"
      }
    },
    {
      files: workspaceGlobs(kNoGetSetPrefixWorkspaces),
      rules: {
        "@jolly-pixel/no-get-set-prefix": "error"
      }
    },
    {
      files: ["**/icons.ts", "**/*Icons.ts"],
      rules: {
        "@stylistic/max-len": "off"
      }
    },
    {
      files: ["packages/voxel-renderer/src/document/**"],
      rules: {
        "no-restricted-imports": [
          "error", {
            patterns: [
              {
                group: ["**/view/**", "three/webgpu", "three/tsl"],
                message: "The voxel document stays headless: it never imports the view."
              }
            ]
          }
        ]
      }
    }
  ]
}));
