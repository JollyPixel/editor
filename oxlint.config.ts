// Import Node.js Dependencies
import { readdirSync } from "node:fs";

// Import Third-party Dependencies
import {
  defineConfig,
  type OxlintOverride
} from "oxlint";
import { typescriptConfig } from "@openally/config.oxlint";

// CONSTANTS
const kUiElements = readdirSync(new URL("./packages/ui/src/elements", import.meta.url))
  .map((file) => file.replace(/\.ts$/, ""));
const kAssetServerLayers = ["common", "model", "storage", "catalog", "live", "node"];

function assetServerLayer(
  layer: string,
  index: number
): OxlintOverride {
  return {
    files: [`packages/asset-server/src/${layer}/**`],
    rules: {
      "no-restricted-imports": [
        "error", {
          patterns: [
            {
              group: kAssetServerLayers.slice(index + 1).map((upper) => `**/${upper}/**`),
              message: `asset-server layers import downward only: ${kAssetServerLayers.join(" <- ")}.`
            }
          ]
        }
      ]
    }
  };
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
    "no-empty": [
      "error", { allowEmptyCatch: true }
    ],
    "max-params": [
      "error", { max: 5 }
    ],
    "unicorn/no-new-array": "error",
    "typescript/parameter-properties": "error",
    "typescript/no-namespace": "error",
    "@jolly-pixel/comment-format": "error",
    "@jolly-pixel/err-declared-error": "error",
    "@jolly-pixel/import-rendered-elements": [
      "error", { elements: kUiElements }
    ],
    "@jolly-pixel/no-enum": "error",
    "@jolly-pixel/no-ts-private": "error",
    "@jolly-pixel/params-per-line": "error",
    "@jolly-pixel/no-comments": "error",
    "@jolly-pixel/no-of-names": "error",
    "@jolly-pixel/no-get-set-prefix": "error"
  },
  overrides: [
    {
      files: ["**/test/**", "**/bench/**"],
      rules: {
        "max-classes-per-file": "off",
        "no-empty-function": "off"
      }
    },
    {
      files: ["packages/ui/**", "**/test/**", "**/bench/**"],
      rules: {
        "@jolly-pixel/import-rendered-elements": "off"
      }
    },
    {
      files: ["**/*.spec.ts", "**/*.test.ts"],
      rules: {
        "max-lines": [
          "error", { max: 300 }
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
    },
    ...kAssetServerLayers.slice(0, -1).map(assetServerLayer),
    {
      files: ["packages/runtime/src/core/**"],
      rules: {
        "no-restricted-imports": [
          "error", {
            patterns: [
              {
                group: ["three", "three/*", "@jolly-pixel/engine", "**/three/**"],
                message: "The runtime core stays renderer-agnostic: three.js code lives in src/three/."
              }
            ]
          }
        ]
      }
    },
    {
      files: ["packages/engine/src/core/**"],
      rules: {
        "no-restricted-imports": [
          "error", {
            patterns: [
              {
                group: ["three", "three/*", "**/three/**"],
                message: "The engine core stays renderer-agnostic: three.js math comes from core/math.ts, the rest lives in src/three/."
              }
            ]
          }
        ]
      }
    },
    {
      files: ["packages/engine/src/core/math.ts"],
      rules: {
        "no-restricted-imports": "off"
      }
    },
    {
      files: [
        "packages/studio/server/**",
        "packages/studio/shared/**",
        "packages/studio/vite/**"
      ],
      rules: {
        "no-restricted-imports": [
          "error", {
            patterns: [
              {
                group: ["**/src/**"],
                message: "Studio src/ is browser-only: share code through shared/."
              }
            ]
          }
        ]
      }
    }
  ]
}));
