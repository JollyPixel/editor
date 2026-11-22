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
  .map((file: string) => file.replace(/\.ts$/, ""));
const kAssetServerLayers = ["common", "model", "storage", "catalog", "live", "client", "node"];
const kAccessorApis = ["getLayoutMap", "setAnimationLoop"];
const kFakeAccessorApis = [
  ...kAccessorApis,
  "getImageData",
  "setTargetAtTime",
  "setTransform",
  "setValueAtTime"
];

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
    "@jolly-pixel/comment-format": "error",
    "@jolly-pixel/err-declared-error": "error",
    "@jolly-pixel/import-rendered-elements": [
      "error", { elements: kUiElements }
    ],
    "@jolly-pixel/no-comments": "error",
    "@jolly-pixel/no-of-names": "error",
    "@openally/no-enum": "error",
    "@openally/no-ts-private": "error",
    "@openally/params-per-line": "error",
    "@openally/no-get-set-prefix": [
      "error", { allow: kAccessorApis }
    ]
  },
  overrides: [
    {
      files: ["**/bench/**"],
      rules: {
        "max-classes-per-file": "off",
        "no-empty-function": "off"
      }
    },
    {
      files: ["**/test/**"],
      rules: {
        "@openally/no-get-set-prefix": [
          "error", { allow: kFakeAccessorApis }
        ]
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
      files: ["packages/physics/src/ecs/**"],
      rules: {
        "no-restricted-imports": [
          "error", {
            patterns: [
              {
                group: ["three", "three/*", "@jolly-pixel/backend.three", "**/three/**"],
                message: "The physics ECS components stay renderer-agnostic: import " +
                  "@jolly-pixel/ecs, three.js code lives in src/three/."
              }
            ]
          }
        ]
      }
    },
    {
      files: ["packages/server/src/**"],
      rules: {
        "no-restricted-imports": [
          "error", {
            patterns: [
              {
                group: ["node:*", "@jolly-pixel/*/node", "**/node/**", "**/testing/**"],
                message: "The server root entry is browser-safe: Node.js code lives in a node/ folder."
              }
            ]
          }
        ]
      }
    },
    {
      files: [
        "packages/server/src/{node,testing}.ts",
        "packages/server/src/testing/**",
        "packages/server/src/*/node/**"
      ],
      rules: {
        "no-restricted-imports": [
          "error", {
            patterns: [
              {
                group: ["fastify", "@fastify/*"],
                message: "Only a concern's node/routes.ts, src/http/node/ and ServerApi speak Fastify."
              }
            ]
          }
        ]
      }
    },
    {
      files: [
        "packages/server/src/*/node/routes.ts",
        "packages/server/src/http/node/**",
        "packages/server/src/server/node/ServerApi.ts"
      ],
      rules: {
        "no-restricted-imports": "off"
      }
    },
    {
      files: [
        "packages/studio/node/**",
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
