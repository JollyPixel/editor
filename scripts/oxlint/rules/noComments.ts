// Import Internal Dependencies
import type { Rule } from "../Rule.ts";

// CONSTANTS
const kRuleList = String.raw`(?:\s+[@\w/-]+(?:\s*,\s*[@\w/-]+)*)?`;
const kAllowed = [
  /^ Import [A-Za-z.-]+ Dependenc(?:y|ies)$/,
  /^ CONSTANTS$/,
  /^\/ <reference /,
  new RegExp(
    String.raw`^\s*(?:eslint|oxlint)-(?:disable|enable)(?:-next-line|-line)?${kRuleList}\s*$`
  ),
  /^\s*@ts-(?:expect-error|ignore|nocheck|check)\s*$/,
  /^\s*(?:[#@]__PURE__|@vite-ignore|c8 ignore[\w\s-]*)\s*$/
];
const kLicense = /license|copyright/i;

export const noComments: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow comments except headers, bare directives, licenses and interface property JSDoc"
    },
    messages: {
      comment: "Remove this comment: names, signatures and docs/*.md carry the meaning."
    },
    schema: []
  },
  create(context) {
    const { sourceCode } = context;
    const propertyDocs = new Set<number>();

    return {
      TSPropertySignature(node) {
        for (const comment of sourceCode.getCommentsBefore(node)) {
          if (comment.type === "Block" && comment.value.startsWith("*")) {
            propertyDocs.add(comment.range[0]);
          }
        }
      },
      "Program:exit"(program) {
        const firstToken = program.body[0]?.range[0] ?? Infinity;

        for (const comment of sourceCode.getAllComments()) {
          const allowed =
            kAllowed.some((pattern) => pattern.test(comment.value)) ||
            propertyDocs.has(comment.range[0]) ||
            (comment.range[0] < firstToken && kLicense.test(comment.value));

          if (!allowed) {
            context.report({
              loc: comment.loc,
              messageId: "comment"
            });
          }
        }
      }
    };
  }
};
