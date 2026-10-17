// Import Internal Dependencies
import type { Rule } from "../Rule.ts";
import { ForbiddenName } from "../ForbiddenName.ts";

// CONSTANTS
const kOfName = /^of$|[a-z0-9](?:Of|For)$/;
const kDefaultAllowed = ["indexOf", "lastIndexOf", "valueOf", "waitFor"];

function isFunction(
  node: { type: string; } | null | undefined
): boolean {
  return node?.type === "ArrowFunctionExpression" || node?.type === "FunctionExpression";
}

export const noOfNames: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow functions and methods named `of` or ending with `Of` or `For`"
    },
    messages: {
      ofName: "`{{name}}` hides its intent: name what it does (`parseX`, `findX`), not a preposition."
    },
    schema: ForbiddenName.schema
  },
  create(context) {
    const forbidden = new ForbiddenName(context, {
      pattern: kOfName,
      allowed: kDefaultAllowed,
      messageId: "ofName"
    });

    return {
      MethodDefinition(node) {
        forbidden.check(node.key);
      },
      TSMethodSignature(node) {
        forbidden.check(node.key);
      },
      FunctionDeclaration(node) {
        forbidden.check(node.id);
      },
      PropertyDefinition(node) {
        if (isFunction(node.value)) {
          forbidden.check(node.key);
        }
      },
      VariableDeclarator(node) {
        if (isFunction(node.init)) {
          forbidden.check(node.id);
        }
      }
    };
  }
};
