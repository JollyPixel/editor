// Import Internal Dependencies
import { noTsPrivate } from "../../../oxlint/rules/noTsPrivate.ts";
import { ruleTester } from "../../helpers/ruleTester.ts";

ruleTester.run("no-ts-private", noTsPrivate, {
  valid: [
    "class A { #count = 0; #tick() {} }",
    "class A { protected render() {} }",
    "class A { private declare value: number; }",
    "class A { private constructor() {} }"
  ],
  invalid: [
    {
      code: "class A { private count = 0; }",
      errors: 1
    },
    {
      code: "class A { private tick() {} }",
      errors: 1
    },
    {
      code: "class A { private get size() { return 1; } }",
      errors: 1
    },
    {
      code: "class A { private accessor value = 1; }",
      errors: 1
    }
  ]
});
