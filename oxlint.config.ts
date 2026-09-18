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
    }
  ]
}));
