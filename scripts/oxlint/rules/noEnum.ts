// Import Internal Dependencies
import type { Rule } from "../Rule.ts";

export const noEnum: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow TypeScript enums"
    },
    messages: {
      enum: "Use a union of literals or an `as const` object instead of an enum."
    },
    schema: []
  },
  create(context) {
    return {
      TSEnumDeclaration(node) {
        context.report({
          node,
          messageId: "enum"
        });
      }
    };
  }
};
