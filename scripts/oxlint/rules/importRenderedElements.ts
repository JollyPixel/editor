// Import Internal Dependencies
import type {
  Rule,
  RuleContext
} from "../Rule.ts";

// CONSTANTS
const kRenderedTag = /<(jolly-[a-z0-9-]+)/g;
const kElementsSubpath = "@jolly-pixel/ui/elements/";

type ReportedNode = NonNullable<Parameters<RuleContext["report"]>[0]["node"]>;

export const importRenderedElements: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require an import of every `@jolly-pixel/ui` element a module renders"
    },
    messages: {
      missing: "Import \"{{source}}\" to register <{{tag}}>."
    },
    schema: [
      {
        type: "object",
        properties: {
          elements: {
            type: "array",
            items: {
              type: "string"
            }
          }
        },
        additionalProperties: false
      }
    ]
  },
  create(context) {
    const [options] = context.options as [{ elements?: string[]; }?];
    const elements = new Set(options?.elements);
    const imported = new Set<string>();
    const rendered = new Map<string, ReportedNode>();

    function render(
      tag: string,
      node: ReportedNode
    ): void {
      if (elements.has(tag.slice("jolly-".length)) && !rendered.has(tag)) {
        rendered.set(tag, node);
      }
    }

    return {
      ImportDeclaration(node) {
        imported.add(node.source.value);
      },
      TaggedTemplateExpression(node) {
        if (node.tag.type !== "Identifier" || node.tag.name !== "html") {
          return;
        }
        for (const quasi of node.quasi.quasis) {
          for (const match of quasi.value.raw.matchAll(kRenderedTag)) {
            render(match[1], node);
          }
        }
      },
      CallExpression(node) {
        const [tag] = node.arguments;
        if (
          node.callee.type === "MemberExpression" &&
          node.callee.property.type === "Identifier" &&
          node.callee.property.name === "createElement" &&
          tag?.type === "Literal" &&
          typeof tag.value === "string" &&
          tag.value.startsWith("jolly-")
        ) {
          render(tag.value, node);
        }
      },
      "Program:exit"() {
        for (const [tag, node] of rendered) {
          const source = kElementsSubpath + tag.slice("jolly-".length);
          if (!imported.has(source)) {
            context.report({
              node,
              messageId: "missing",
              data: {
                source,
                tag
              }
            });
          }
        }
      }
    };
  }
};
