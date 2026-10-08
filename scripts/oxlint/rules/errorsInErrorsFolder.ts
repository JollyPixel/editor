// Import Internal Dependencies
import type { Rule } from "../Rule.ts";

// CONSTANTS
const kErrorName = /Error$/;

export const errorsInErrorsFolder: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Require custom error classes to live in an `errors/` folder beside their owner"
    },
    messages: {
      location: "Move `{{name}}` into an `errors/` folder beside the code that throws it."
    },
    schema: []
  },
  create(context) {
    if (context.filename.replaceAll("\\", "/").includes("/errors/")) {
      return {};
    }

    return {
      ClassDeclaration(node) {
        if (
          node.superClass?.type === "Identifier" &&
          kErrorName.test(node.superClass.name)
        ) {
          context.report({
            node: node.id ?? node,
            messageId: "location",
            data: {
              name: node.id?.name ?? "anonymous error class"
            }
          });
        }
      }
    };
  }
};
