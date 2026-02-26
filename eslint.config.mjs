import { typescriptConfig, globals } from "@openally/config.eslint";

export default [
  {
    ignores: [
      "**/coverage/**"
    ],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.browser
      }
    }
  },
  ...typescriptConfig({
    rules: {
      "@stylistic/no-mixed-operators": "off",
      "max-classes-per-file": "off"
    }
  })
];
