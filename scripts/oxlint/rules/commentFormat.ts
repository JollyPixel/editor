// Import Internal Dependencies
import type { Rule } from "../Rule.ts";

// CONSTANTS
const kEmDash = "\u2014";

export const commentFormat: Rule = {
  meta: {
    type: "layout",
    docs: {
      description: "Require JSDoc blocks on three lines and forbid em dashes in comments"
    },
    messages: {
      singleLineJsDoc: "Write the JSDoc block on three lines (`/**`, ` * text`, ` */`).",
      emDash: "Do not use an em dash in comments."
    },
    fixable: "whitespace",
    schema: []
  },
  create(context) {
    const { sourceCode } = context;
    const eol = sourceCode.text.includes("\r\n") ? "\r\n" : "\n";

    return {
      Program() {
        for (const comment of sourceCode.getAllComments()) {
          if (comment.value.includes(kEmDash)) {
            context.report({
              loc: comment.loc,
              messageId: "emDash"
            });
          }

          const isJsDoc = comment.type === "Block" && /^\*[^*]/.test(comment.value);
          if (!isJsDoc || comment.loc.start.line !== comment.loc.end.line) {
            continue;
          }

          const lineStart = sourceCode.text.lastIndexOf("\n", comment.range[0] - 1) + 1;
          const indent = sourceCode.text.slice(lineStart, comment.range[0]);
          const text = comment.value.slice(1).trim();
          const expanded = `/**${eol}${indent} * ${text}${eol}${indent} */`;

          context.report({
            loc: comment.loc,
            messageId: "singleLineJsDoc",
            fix: /^\s*$/.test(indent) && text.length > 0 ?
              (fixer) => fixer.replaceTextRange(comment.range, expanded) :
              undefined
          });
        }
      }
    };
  }
};
