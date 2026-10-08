// Import Internal Dependencies
import type { Rule } from "../Rule.ts";
import { DeclaredName, type KeyNode } from "../DeclaredName.ts";
import { NameAllowList } from "../NameAllowList.ts";

// CONSTANTS
const kAccessorPrefix = /^(get|set)[A-Z0-9_]/;
const kWebApis = [
  "getAttribute",
  "getBoundingClientRect",
  "getClientRects",
  "getComputedStyle",
  "getContext",
  "getGamepads",
  "getImageData",
  "getItem",
  "getPropertyValue",
  "getRootNode",
  "setAnimationLoop",
  "setAttribute",
  "setItem",
  "setPointerCapture",
  "setProperty"
];

export const noGetSetPrefix: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow methods prefixed with `get`/`set` in favour of accessors or intent names"
    },
    messages: {
      prefix: "`{{name}}`: use a real getter/setter or name the method after what it does."
    },
    schema: NameAllowList.schema
  },
  create(context) {
    const allowed = NameAllowList.parse(context.options, kWebApis);

    function check(
      key: KeyNode
    ): void {
      const name = DeclaredName.read(key);
      if (name !== null && kAccessorPrefix.test(name.text) && !allowed.has(name.text)) {
        context.report({
          node: name.node,
          messageId: "prefix",
          data: {
            name: name.text
          }
        });
      }
    }

    return {
      MethodDefinition(node) {
        if (node.kind === "method" && node.override !== true) {
          check(node.key);
        }
      },
      TSMethodSignature(node) {
        if (node.kind === "method") {
          check(node.key);
        }
      }
    };
  }
};
