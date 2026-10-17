// Import Internal Dependencies
import type { RuleContext } from "./Rule.ts";

export interface KeyNode {
  range: [number, number];
  name?: unknown;
}

export interface ForbiddenNameOptions {
  pattern: RegExp;
  allowed: readonly string[];
  messageId: string;
}

type AllowOptions = readonly [{ allow?: string[]; }?];

export class ForbiddenName {
  static readonly schema = [
    {
      type: "object",
      properties: {
        allow: {
          type: "array",
          items: {
            type: "string"
          }
        }
      },
      additionalProperties: false
    }
  ];

  readonly #context: RuleContext;
  readonly #pattern: RegExp;
  readonly #allowed: ReadonlySet<string>;
  readonly #messageId: string;

  constructor(
    context: RuleContext,
    options: ForbiddenNameOptions
  ) {
    const [{ allow = [] } = {}] = context.options as AllowOptions;

    this.#context = context;
    this.#pattern = options.pattern;
    this.#allowed = new Set([...options.allowed, ...allow]);
    this.#messageId = options.messageId;
  }

  check(
    key: KeyNode | null | undefined
  ): void {
    if (
      typeof key?.name === "string" &&
      this.#pattern.test(key.name) &&
      !this.#allowed.has(key.name)
    ) {
      this.#context.report({
        node: key,
        messageId: this.#messageId,
        data: {
          name: key.name
        }
      });
    }
  }
}
