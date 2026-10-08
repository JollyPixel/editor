// Import Internal Dependencies
import type { Rule } from "../Rule.ts";

export const noTsPrivate: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow the TypeScript `private` modifier in favour of `#private` members"
    },
    messages: {
      private: "Use a `#private` member instead of the TypeScript `private` modifier."
    },
    schema: []
  },
  create(context) {
    return {
      MethodDefinition(node) {
        if (node.accessibility === "private" && node.kind !== "constructor") {
          context.report({
            node: node.key,
            messageId: "private"
          });
        }
      },
      PropertyDefinition(node) {
        if (node.accessibility === "private" && node.declare !== true) {
          context.report({
            node: node.key,
            messageId: "private"
          });
        }
      },
      AccessorProperty(node) {
        if (node.accessibility === "private") {
          context.report({
            node: node.key,
            messageId: "private"
          });
        }
      }
    };
  }
};
