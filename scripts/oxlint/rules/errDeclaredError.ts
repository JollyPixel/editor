// Import Internal Dependencies
import type { Rule } from "../Rule.ts";

export const errDeclaredError: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Require the error passed to `Err()` to be built in its own `const`"
    },
    messages: {
      inline: "Build the error in its own `const` and pass that to `Err()`."
    },
    schema: []
  },
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "Err" &&
          node.arguments[0]?.type === "NewExpression"
        ) {
          context.report({
            node: node.arguments[0],
            messageId: "inline"
          });
        }
      }
    };
  }
};
