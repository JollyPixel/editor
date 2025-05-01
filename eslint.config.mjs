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
  ...typescriptConfig()
];
