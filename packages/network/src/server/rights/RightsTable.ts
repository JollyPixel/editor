// Import Internal Dependencies
import { RightsGate } from "./RightsGate.ts";
import { RightsPattern } from "./RightsPattern.ts";
import { UnknownDefaultRoleError } from "../errors/UnknownDefaultRoleError.ts";
import { DEFAULT_ROLE } from "../../protocol/constants.ts";
import type { Right } from "../../protocol/types.ts";

export type RightsMap = Record<string, Record<string, Right>>;

export interface RightsScopeOptions {
  readOnly?: boolean;
}

interface Permission {
  pattern: RightsPattern;
  right: Right;
}

export class RightsTable {
  #defaultRole: string;
  #rules: Map<string, Permission[]> | undefined;
  #revision = 0;

  constructor(
    table?: RightsMap,
    defaultRole?: string
  ) {
    this.#defaultRole = defaultRole ?? DEFAULT_ROLE;
    this.#rules = compileRules(table, defaultRole);
  }

  get defaultRole(): string {
    return this.#defaultRole;
  }

  get configured(): boolean {
    return this.#rules !== undefined;
  }

  get revision(): number {
    return this.#revision;
  }

  get roles(): readonly string[] {
    return this.#rules === undefined ? [] : [...this.#rules.keys()];
  }

  replace(
    table: RightsMap,
    defaultRole?: string
  ): void {
    const rules = compileRules(table, defaultRole);
    if (this.#rules === undefined || rules === undefined) {
      throw new TypeError(
        "only a configured rights table can be replaced, by a configured one"
      );
    }

    this.#rules = rules;
    this.#defaultRole = defaultRole ?? DEFAULT_ROLE;
    this.#revision++;
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
    namespace: string,
    options: RightsScopeOptions = {}
  ): RightsGate {
    return new RightsGate(
      this,
      namespace,
      options.readOnly ?? false
    );
  }
}

function compileRules(
  table: RightsMap | undefined,
  defaultRole: string | undefined
): Map<string, Permission[]> | undefined {
  if (!table || Object.keys(table).length === 0) {
    return undefined;
  }

  const rules = new Map(
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
    !rules.has(defaultRole)
  ) {
    throw new UnknownDefaultRoleError(
      `defaultRole "${defaultRole}" is not a role of the rights table`
    );
  }

  return rules;
}
