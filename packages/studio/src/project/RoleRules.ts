// Import Third-party Dependencies
import {
  RightsPattern,
  type Right
} from "@jolly-pixel/network";
import { namedRight, type NamedRight } from "@jolly-pixel/server";

export interface RoleRule {
  readonly pattern: string;
  readonly right: Right;
}

export interface RuleMatch {
  readonly index: number;
  readonly rule: RoleRule;
}

export class RoleRules implements Iterable<RoleRule> {
  static from(
    record: Readonly<Record<string, Right>>
  ): RoleRules {
    return new RoleRules(
      Object.entries(record).map(([pattern, right]) => {
        return {
          pattern,
          right
        };
      })
    );
  }

  #rules: readonly RoleRule[];

  constructor(
    rules: Iterable<RoleRule>
  ) {
    this.#rules = [...rules];
  }

  get size(): number {
    return this.#rules.length;
  }

  match(
    key: string
  ): RuleMatch | null {
    const index = this.#rules.findIndex(
      ({ pattern }) => new RightsPattern(pattern).matches(key)
    );

    return index === -1 ?
      null :
      {
        index,
        rule: this.#rules[index]
      };
  }

  effective(
    key: string
  ): Right {
    return this.match(key)?.rule.right ?? "void";
  }

  named(
    name: NamedRight
  ): Right {
    return namedRight(this.toJSON(), name);
  }

  move(
    from: number,
    to: number
  ): RoleRules {
    const rules = [...this.#rules];
    const [rule] = rules.splice(from, 1);
    if (rule === undefined) {
      return this;
    }
    rules.splice(Math.max(0, Math.min(to, rules.length)), 0, rule);

    return new RoleRules(rules);
  }

  replace(
    index: number,
    rule: RoleRule
  ): RoleRules {
    return new RoleRules(
      this.#rules
        .map((current, position) => (position === index ? rule : current))
        .filter(({ pattern }, position) => position === index || pattern !== rule.pattern)
    );
  }

  remove(
    index: number
  ): RoleRules {
    return new RoleRules(
      this.#rules.filter((_rule, position) => position !== index)
    );
  }

  withExact(
    rules: Readonly<Record<string, Right>>
  ): RoleRules {
    return new RoleRules([
      ...RoleRules.from(rules),
      ...this.without(Object.keys(rules))
    ]);
  }

  without(
    patterns: Iterable<string>
  ): RoleRules {
    const removed = new Set(patterns);

    return new RoleRules(
      this.#rules.filter(({ pattern }) => !removed.has(pattern))
    );
  }

  toJSON(): Record<string, Right> {
    return Object.fromEntries(
      this.#rules.map(({ pattern, right }) => [pattern, right])
    );
  }

  [Symbol.iterator](): IterableIterator<RoleRule> {
    return this.#rules.values();
  }
}
