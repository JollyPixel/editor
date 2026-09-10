// Import Third-party Dependencies
import picomatch from "picomatch";

// Import Internal Dependencies
import { RightsGate } from "./RightsGate.ts";
import { UnknownDefaultRoleError } from "../errors.ts";
import type { Right } from "../../protocol/types.ts";

// CONSTANTS
const kImplicitDefaultRole = "default";

export type RightsMap = Record<string, Record<string, Right>>;

interface Permission {
  isMatch: picomatch.Matcher;
  right: Right;
}

/**
 * Per-role access lookup by glob against `${extension.name}.${event}`.
 * No table means "write"; with one, an absent role is "void".
 */
export class RightsTable {
  readonly defaultRole: string;

  #rules: Map<string, Permission[]> | undefined;

  constructor(
    table?: RightsMap,
    defaultRole?: string
  ) {
    this.defaultRole = defaultRole ?? kImplicitDefaultRole;

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
