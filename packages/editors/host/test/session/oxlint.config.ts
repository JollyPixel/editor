import config from "../../../../../oxlint.config.ts";

export default {
  ...config,
  overrides: [
    ...config.overrides ?? [],
    {
      files: ["EditorSession.tst.ts", "oxlint.config.ts"],
      rules: {
        "@openally/imports": "off"
      }
    }
  ]
};
