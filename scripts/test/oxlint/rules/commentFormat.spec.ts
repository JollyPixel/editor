// Import Internal Dependencies
import { commentFormat } from "../../../oxlint/rules/commentFormat.ts";
import { ruleTester } from "../../helpers/ruleTester.ts";

ruleTester.run("comment-format", commentFormat, {
  valid: [
    "interface A {\n  /**\n   * Size in pixels.\n   */\n  size: number;\n}",
    "const a = /*#__PURE__*/ make();",
    "// Import Internal Dependencies\nimport { a } from \"./a.ts\";"
  ],
  invalid: [
    {
      code: "interface A {\n  /** Size in pixels. */\n  size: number;\n}",
      output: "interface A {\n  /**\n   * Size in pixels.\n   */\n  size: number;\n}",
      errors: 1
    },
    {
      code: "interface A {\r\n  /** Size in pixels. */\r\n  size: number;\r\n}",
      output: "interface A {\r\n  /**\r\n   * Size in pixels.\r\n   */\r\n  size: number;\r\n}",
      errors: 1
    },
    {
      code: "const size = 1; /** Size */",
      output: null,
      errors: 1
    },
    {
      code: "// rows \u2014 columns\nconst a = 1;",
      errors: 1
    }
  ]
});
