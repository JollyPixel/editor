// Import Internal Dependencies
import { commentFormat } from "./rules/commentFormat.ts";
import { errDeclaredError } from "./rules/errDeclaredError.ts";
import { errorsInErrorsFolder } from "./rules/errorsInErrorsFolder.ts";
import { noComments } from "./rules/noComments.ts";
import { noEnum } from "./rules/noEnum.ts";
import { noGetSetPrefix } from "./rules/noGetSetPrefix.ts";
import { noOfNames } from "./rules/noOfNames.ts";
import { noTsPrivate } from "./rules/noTsPrivate.ts";

export default {
  meta: {
    name: "@jolly-pixel"
  },
  rules: {
    "comment-format": commentFormat,
    "err-declared-error": errDeclaredError,
    "errors-in-errors-folder": errorsInErrorsFolder,
    "no-comments": noComments,
    "no-enum": noEnum,
    "no-get-set-prefix": noGetSetPrefix,
    "no-of-names": noOfNames,
    "no-ts-private": noTsPrivate
  }
};
