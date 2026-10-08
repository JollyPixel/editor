// Import Internal Dependencies
import { noGetSetPrefix } from "../../../oxlint/rules/noGetSetPrefix.ts";
import { ruleTester } from "../../helpers/ruleTester.ts";

ruleTester.run("no-get-set-prefix", noGetSetPrefix, {
  valid: [
    "class A { get size() { return 1; } set size(v) {} settle() {} getter() {} }",
    "class A extends B { override getContext() { return null; } }",
    "getValue();",
    {
      code: "class A { getContext() {} }",
      options: [{ allow: ["getContext"] }]
    }
  ],
  invalid: [
    {
      code: "class A { getSize() {} #setState() {} static getDefault() {} }",
      errors: 3
    },
    {
      code: "interface A { getValue(): number; }",
      errors: 1
    }
  ]
});
