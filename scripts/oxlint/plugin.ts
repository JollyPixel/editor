// Import Internal Dependencies
import { commentFormat } from "./rules/commentFormat.ts";
import { errDeclaredError } from "./rules/errDeclaredError.ts";
import { errorsInErrorsFolder } from "./rules/errorsInErrorsFolder.ts";
import { importRenderedElements } from "./rules/importRenderedElements.ts";
import { noComments } from "./rules/noComments.ts";
import { noOfNames } from "./rules/noOfNames.ts";

export default {
  meta: {
    name: "@jolly-pixel"
  },
  rules: {
    "comment-format": commentFormat,
    "err-declared-error": errDeclaredError,
    "errors-in-errors-folder": errorsInErrorsFolder,
    "import-rendered-elements": importRenderedElements,
    "no-comments": noComments,
    "no-of-names": noOfNames
  }
};
