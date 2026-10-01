// Import Third-party Dependencies
import { defineConfig } from "oxlint";
import { typescriptConfig } from "@openally/config.oxlint";

export default defineConfig(typescriptConfig({
  ignorePatterns: [
    "**/coverage/**",
    "**/generated/**"
  ],
  env: {
    browser: true
  },
  rules: {
    "@stylistic/no-mixed-operators": "off",
    "max-params": [
      "error", { max: 5 }
    ]
  },
  overrides: [
    {
      files: ["**/test/**", "**/bench/**"],
      rules: {
        "max-classes-per-file": "off"
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
