// Import Third-party Dependencies
import picomatch from "picomatch";

// Import Internal Dependencies
import { RightsGate } from "./RightsGate.ts";

/**
 * "void": cannot receive or send.
 * "read": can receive, cannot send.
 * "write": can receive and send.
 */
export type Right = "read" | "write" | "void";

export type RightsMap = Record<string, Record<string, Right>>;

interface Permission {
  isMatch: picomatch.Matcher;
  right: Right;
}

/**
 * Per-role access lookup by glob against `${extension.name}.${event}`.
 * Missing table/role/no match defaults to "write".
 */
export class RightsTable {
  #rules: Map<string, Permission[]> | undefined;

  constructor(
    table?: RightsMap
  ) {
    if (!table || Object.keys(table).length === 0) {
      this.#rules = undefined;

      return;
    }

    this.#rules = new Map(
      Object.entries(table).map(([role, patterns]) => [
        role,
        Object.entries(patterns).map(([pattern, right]) => {
          return {
            isMatch: picomatch(pattern),
            right
          };
        })
      ])
    );
  }

  get configured(): boolean {
    return this.#rules !== undefined;
  }

  check(
    role: string,
    key: string
  ): Right {
    const rules = this.#rules?.get(role);
    if (!rules) {
      return "write";
    }

    const rule = rules.find(
      ({ isMatch }) => isMatch(key)
    );

    return rule?.right ?? "write";
  }

  scope(
    namespace: string
  ): RightsGate {
    return new RightsGate(
      this,
      namespace
    );
  }
}
