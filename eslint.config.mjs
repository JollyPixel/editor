import { typescriptConfig, globals } from "@openally/config.eslint";

export default [
  {
    ignores: [
      "src/**/coverage"
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
