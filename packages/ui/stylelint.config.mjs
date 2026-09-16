/** @type {import("stylelint").Config} */
export default {
  extends: ["stylelint-config-recommended"],
  rules: {
    "no-descending-specificity": null,
    "no-duplicate-selectors": true
  },
  overrides: [
    {
      files: ["**/*.ts"],
      customSyntax: "postcss-lit",
      rules: {
        "no-empty-source": null
      }
    }
  ]
};
