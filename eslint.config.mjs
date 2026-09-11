import {
  typescriptConfig,
  globals
} from "@openally/config.eslint";

export default [
  {
    ignores: [
      "**/coverage/**",
      "**/generated/**"
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
      "@stylistic/function-paren-newline": "off",
      "max-classes-per-file": "off",
      "max-params": [
        "error", { max: 5 }
      ]
    }
  })
];
