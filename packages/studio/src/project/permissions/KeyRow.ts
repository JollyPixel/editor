// Import Third-party Dependencies
import type { Right } from "@jolly-pixel/network/client";
import type { NamedRight } from "@jolly-pixel/server";

// Import Internal Dependencies
import type { RoleRules } from "../RoleRules.ts";
import {
  offeredUpTo,
  type PermissionRow,
  type PermissionRowInit
} from "./PermissionRow.ts";

export class KeyRow implements PermissionRow {
  readonly id: string;
  readonly label: string;
  readonly description: string | undefined;
  readonly options: readonly Right[];
  readonly keys: readonly string[];

  constructor(
    key: string,
    options: readonly Right[],
    init: PermissionRowInit
  ) {
    this.id = key;
    this.label = init.label;
    this.description = init.description;
    this.options = options;
    this.keys = [key];
  }

  rightIn(
    rules: RoleRules
  ): Right {
    return offeredUpTo(this.options, rules.effective(this.id));
  }

  applyTo(
    rules: RoleRules,
    right: Right
  ): RoleRules {
    return rules.withExact({ [this.id]: right });
  }

  reachable(): boolean {
    return true;
  }
}

export class NamedRow extends KeyRow {
  readonly #name: NamedRight;

  constructor(
    name: NamedRight,
    options: readonly Right[],
    init: PermissionRowInit
  ) {
    super(name, options, init);
    this.#name = name;
  }

  override rightIn(
    rules: RoleRules
  ): Right {
    return offeredUpTo(this.options, rules.named(this.#name));
  }
}
