// Import Internal Dependencies
import type { Rule } from "../Rule.ts";
import { DeclaredName, type KeyNode } from "../DeclaredName.ts";
import { NameAllowList } from "../NameAllowList.ts";

// CONSTANTS
const kOfSuffix = /[a-z0-9]Of$/;
const kDefaultAllowed = ["indexOf", "lastIndexOf", "valueOf"];

function isFunction(
  node: { type: string; } | null | undefined
): boolean {
  return node?.type === "ArrowFunctionExpression" || node?.type === "FunctionExpression";
}

export const noOfNames: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow functions and methods named `of` or ending with `Of`"
    },
    messages: {
      ofName: "`{{name}}` hides its intent: name the action (`parseX`, `fromX`, `xFor`) instead of `of`."
    },
    schema: NameAllowList.schema
  },
  create(context) {
    const allowed = NameAllowList.parse(context.options, kDefaultAllowed);

    function check(
      key: KeyNode | null | undefined
    ): void {
      const name = DeclaredName.read(key);
      if (name === null || allowed.has(name.text)) {
        return;
      }
      if (name.text === "of" || kOfSuffix.test(name.text)) {
        context.report({
          node: name.node,
          messageId: "ofName",
          data: {
            name: name.text
          }
        });
      }
    }

    return {
      MethodDefinition(node) {
        check(node.key);
      },
      TSMethodSignature(node) {
        check(node.key);
      },
      FunctionDeclaration(node) {
        check(node.id);
      },
      PropertyDefinition(node) {
        if (isFunction(node.value)) {
          check(node.key);
        }
      },
      VariableDeclarator(node) {
        if (isFunction(node.init)) {
          check(node.id);
        }
      }
    };
  }
};
