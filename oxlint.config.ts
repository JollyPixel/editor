// Import Third-party Dependencies
import { defineConfig } from "oxlint";
import { typescriptConfig } from "@openally/config.oxlint";

// CONSTANTS
const kPublicAccessors = [
  "getActor",
  "getActorByPath",
  "getActors",
  "getAll",
  "getAllActors",
  "getAllChunks",
  "getAllChunksToBeRemoved",
  "getAllDirtyChunks",
  "getAsset",
  "getAt",
  "getBoundingBox",
  "getChunk",
  "getChunks",
  "getComponent",
  "getComponents",
  "getDirtyChunks",
  "getForward",
  "getGlobalEulerAngles",
  "getGlobalMatrix",
  "getGlobalOrientation",
  "getGlobalPosition",
  "getLayer",
  "getLayerById",
  "getLayers",
  "getLocalEulerAngles",
  "getLocalOrientation",
  "getLocalPosition",
  "getLocalScale",
  "getObject",
  "getOrCreateChunk",
  "getPackedAt",
  "getPackedVoxelAt",
  "getParentGlobalOrientation",
  "getPartnerAt",
  "getPartnerVoxelAt",
  "getProperty",
  "getRight",
  "getRootActors",
  "getScene",
  "getSource",
  "getTrackByIndex",
  "getUp",
  "getValue",
  "getViewport",
  "getVisible",
  "getVoxelAt",
  "getVoxelNeighbour",
  "getVoxelWithLayerAt",
  "setClipNameRewriter",
  "setClips",
  "setDepth",
  "setFadeDuration",
  "setFont",
  "setFov",
  "setFrame",
  "setGeometryOptions",
  "setGlobalEulerAngles",
  "setGlobalMatrix",
  "setGlobalOrientation",
  "setGlobalPosition",
  "setHorizontalFlip",
  "setLayerPosition",
  "setLevel",
  "setLocalEulerAngles",
  "setLocalOrientation",
  "setLocalPosition",
  "setLocalScale",
  "setMaterial",
  "setMixer",
  "setNearFar",
  "setOpacity",
  "setOrthographicScale",
  "setPackedAt",
  "setPackedLocal",
  "setPackedVoxelAt",
  "setParent",
  "setProjectionMode",
  "setRatio",
  "setStyle",
  "setTranslation",
  "setValue",
  "setVerticalFlip",
  "setViewport",
  "setVisible",
  "setVoxel",
  "setVoxelAt",
  "setVoxelBulk",
  "setWireframe"
];

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
    "@jolly-pixel/no-enum": "error",
    "@jolly-pixel/no-ts-private": "error",
    "@jolly-pixel/no-comments": "error",
    "@jolly-pixel/no-of-names": "error",
    "@jolly-pixel/no-get-set-prefix": [
      "error", { allow: kPublicAccessors }
    ]
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
    }
  ]
}));
