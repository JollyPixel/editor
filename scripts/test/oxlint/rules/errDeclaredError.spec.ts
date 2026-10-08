// Import Internal Dependencies
import { errDeclaredError } from "../../../oxlint/rules/errDeclaredError.ts";
import { ruleTester } from "../../helpers/ruleTester.ts";

ruleTester.run("err-declared-error", errDeclaredError, {
  valid: [
    "const error = new Error(\"x\"); Err(error);",
    "Ok(new Value());",
    "Err(\"reason\");"
  ],
  invalid: [
    {
      code: "function f() { return Err(new Error(\"x\")); }",
      errors: 1
    }
  ]
});
