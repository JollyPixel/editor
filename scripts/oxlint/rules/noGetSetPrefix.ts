// Import Internal Dependencies
import type { Rule } from "../Rule.ts";
import { ForbiddenName } from "../ForbiddenName.ts";

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
  "getLayoutMap",
  "getPropertyValue",
  "getRootNode",
  "setAnimationLoop",
  "setAttribute",
  "setItem",
  "setPointerCapture",
  "setProperty",
  "setTransform"
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
    schema: ForbiddenName.schema
  },
  create(context) {
    const forbidden = new ForbiddenName(context, {
      pattern: kAccessorPrefix,
      allowed: kWebApis,
      messageId: "prefix"
    });

    return {
      MethodDefinition(node) {
        if (node.kind === "method" && node.override !== true) {
          forbidden.check(node.key);
        }
      },
      TSMethodSignature(node) {
        if (node.kind === "method") {
          forbidden.check(node.key);
        }
      }
    };
  }
};
