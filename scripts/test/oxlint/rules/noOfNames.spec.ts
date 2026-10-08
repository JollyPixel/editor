// Import Internal Dependencies
import { noOfNames } from "../../../oxlint/rules/noOfNames.ts";
import { ruleTester } from "../../helpers/ruleTester.ts";

ruleTester.run("no-of-names", noOfNames, {
  valid: [
    "class A { parsePolicy() {} replacementFor() {} indexOf() {} valueOf() {} }",
    "const offset = 1; const sizeOf = 2;",
    "items.indexOf(x); Array.of(1); boxOf(x);",
    {
      code: "function rectOf() {}",
      options: [{ allow: ["rectOf"] }]
    }
  ],
  invalid: [
    {
      code: "class A { static of() {} #policyOf() {} }",
      errors: 2
    },
    {
      code: "function rectOf() {} const slotsOf = () => [];",
      errors: 2
    },
    {
      code: "interface Keys { chordsOf(action: string): string[]; }",
      errors: 1
    },
    {
      code: "class A { zoneOf = (id: number) => id; }",
      errors: 1
    }
  ]
});
