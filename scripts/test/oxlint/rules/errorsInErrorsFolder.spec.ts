// Import Internal Dependencies
import { errorsInErrorsFolder } from "../../../oxlint/rules/errorsInErrorsFolder.ts";
import { ruleTester } from "../../helpers/ruleTester.ts";

// CONSTANTS
const kErrorClass = "export class InvalidPathError extends Error {}";

ruleTester.run("errors-in-errors-folder", errorsInErrorsFolder, {
  valid: [
    {
      code: kErrorClass,
      filename: "packages/asset-server/src/kinds/errors/InvalidPathError.ts"
    },
    {
      code: "class Store extends Map {}",
      filename: "packages/asset-server/src/Store.ts"
    }
  ],
  invalid: [
    {
      code: kErrorClass,
      filename: "packages/asset-server/src/kinds/AssetKinds.ts",
      errors: 1
    },
    {
      code: "class RefusedError extends InvalidPathError {}",
      filename: "packages/asset-server/src/errorsHelper.ts",
      errors: 1
    }
  ]
});
