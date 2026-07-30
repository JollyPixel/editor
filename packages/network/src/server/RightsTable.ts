// Import Internal Dependencies
import { compileGlobPattern } from "../utils/glob.ts";

/**
 * "void": cannot receive or send.
 * "read": can receive, cannot send.
 * "write": can receive and send.
 */
export type Right = "read" | "write" | "void";

export type RightsMap = Record<string, Record<string, Right>>;

// Reserved room events. "$" avoids collisions with domain action names.
export const JOIN_EVENT = "$join";
export const PRESENCE_EVENT = "$presence";

interface Permission {
  pattern: RegExp;
  right: Right;
}

/**
 * Per-role access lookup by glob against `${authority.name}.${event}`.
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
            pattern: compileGlobPattern(pattern),
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

    const rule = rules.find(({ pattern }) => pattern.test(key));

    return rule?.right ?? "write";
  }

  scope(
    namespace: string
  ): RightsGate {
    return new RightsGate(this, namespace);
  }
}

export class RightsGate {
  #table: RightsTable;
  #namespace: string;

  constructor(
    table: RightsTable,
    namespace: string
  ) {
    this.#table = table;
    this.#namespace = namespace;
  }

  get configured(): boolean {
    return this.#table.configured;
  }

  check(
    role: string,
    event: string
  ): Right {
    return this.#table.check(role, `${this.#namespace}.${event}`);
  }

  canWrite(
    role: string,
    event: string
  ): boolean {
    return this.check(role, event) === "write";
  }
}
