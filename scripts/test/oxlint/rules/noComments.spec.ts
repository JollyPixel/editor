// Import Internal Dependencies
import { noComments } from "../../../oxlint/rules/noComments.ts";
import { ruleTester } from "../../helpers/ruleTester.ts";

ruleTester.run("no-comments", noComments, {
  valid: [
    "// Import Node.js Dependencies\nimport fs from \"node:fs\";\n\n// CONSTANTS\nconst kSize = 1;",
    "// eslint-disable-next-line no-new, no-void\nnew A();",
    "// oxlint-disable-next-line unicorn/no-new-array\nconst a = new Array(2);",
    "// @ts-expect-error\nconst a: number = \"x\";",
    "const a = /*#__PURE__*/ make();\nawait import(/* @vite-ignore */ url);",
    "/*\n * Copyright (c) 2020 Someone. MIT License.\n */\nexport const a = 1;",
    "export interface Options {\n  /**\n   * Size in pixels.\n   */\n  size: number;\n}",
    "type Options = {\n  /**\n   * Size in pixels.\n   */\n  size: number;\n};"
  ],
  invalid: [
    {
      code: "// keeps the order stable\nconst a = 1;",
      errors: 1
    },
    {
      code: "/**\n * A class.\n */\nclass A {\n  /**\n   * Runs.\n   */\n  run() {}\n}",
      errors: 2
    },
    {
      code: "interface A {\n  /**\n   * Runs.\n   */\n  run(): void;\n}",
      errors: 1
    },
    {
      code: "// @ts-expect-error the type is wrong on purpose\nconst a: number = \"x\";",
      errors: 1
    },
    {
      code: "// eslint-disable-next-line no-new -- side effect\nnew A();",
      errors: 1
    },
    {
      code: "export const a = 1;\n/*\n * Copyright (c) 2020 Someone.\n */",
      errors: 1
    }
  ]
});
