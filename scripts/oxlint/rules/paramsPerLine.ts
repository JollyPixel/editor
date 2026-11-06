// Import Internal Dependencies
import type { Rule } from "../Rule.ts";

// CONSTANTS
const kMaxInlineParams = 2;

interface ParameterNode {
  loc: {
    start: {
      line: number;
    };
  };
}

interface SignatureNode {
  params: ParameterNode[];
}

export const paramsPerLine: Rule = {
  meta: {
    type: "layout",
    docs: {
      description: "Put each parameter on its own line when a signature has more than two"
    },
    messages: {
      shared: "Put each of these {{count}} parameters on its own line."
    },
    schema: []
  },
  create(context) {
    function check(
      node: SignatureNode
    ): void {
      const { params } = node;
      if (params.length <= kMaxInlineParams) {
        return;
      }

      const lines = new Set(params.map((param) => param.loc.start.line));
      if (lines.size < params.length) {
        context.report({
          node: node as never,
          messageId: "shared",
          data: {
            count: String(params.length)
          }
        });
      }
    }

    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
      TSDeclareFunction: check,
      TSEmptyBodyFunctionExpression: check,
      TSMethodSignature: check
    } as never;
  }
};
