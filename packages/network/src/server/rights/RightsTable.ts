// Import Internal Dependencies
import { RightsGate } from "./RightsGate.ts";
import { RightsPattern } from "./RightsPattern.ts";
import { UnknownDefaultRoleError } from "../errors/UnknownDefaultRoleError.ts";
import { DEFAULT_ROLE } from "../../protocol/constants.ts";
import type { Right } from "../../protocol/types.ts";

export type RightsMap = Record<string, Record<string, Right>>;

interface Permission {
  pattern: RightsPattern;
  right: Right;
}

/**
 * Per-role access lookup by glob against `${extension.name}.${event}`.
 * No table means "write"; with one, anything unmatched is "void".
 */
export class RightsTable {
  readonly defaultRole: string;

  #rules: Map<string, Permission[]> | undefined;

  constructor(
    table?: RightsMap,
    defaultRole?: string
  ) {
    this.defaultRole = defaultRole ?? DEFAULT_ROLE;

    if (!table || Object.keys(table).length === 0) {
      this.#rules = undefined;

      return;
    }

    this.#rules = new Map(
      Object.entries(table).map(([role, patterns]) => [
        role,
        Object.entries(patterns).map(([pattern, right]) => {
          return {
            pattern: new RightsPattern(pattern),
            right
          };
        })
      ])
    );

    if (
      defaultRole !== undefined &&
      !this.#rules.has(defaultRole)
    ) {
      throw new UnknownDefaultRoleError(
        `defaultRole "${defaultRole}" is not a role of the rights table`
      );
    }
  }

  get configured(): boolean {
    return this.#rules !== undefined;
  }

  get roles(): readonly string[] {
    return this.#rules === undefined ? [] : [...this.#rules.keys()];
  }

  check(
    role: string,
    key: string
  ): Right {
    if (this.#rules === undefined) {
      return "write";
    }

    const rules = this.#rules.get(role);
    if (rules === undefined) {
      return "void";
    }

    const rule = rules.find(
      ({ pattern }) => pattern.matches(key)
    );

    return rule?.right ?? "void";
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
