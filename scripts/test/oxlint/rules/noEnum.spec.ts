// Import Internal Dependencies
import { noEnum } from "../../../oxlint/rules/noEnum.ts";
import { ruleTester } from "../../helpers/ruleTester.ts";

ruleTester.run("no-enum", noEnum, {
  valid: [
    "type Mode = \"read\" | \"write\";",
    "const Mode = { Read: 0 } as const;"
  ],
  invalid: [
    {
      code: "enum Mode { Read, Write }",
      errors: 1
    },
    {
      code: "export const enum Mode { Read }",
      errors: 1
    }
  ]
});
