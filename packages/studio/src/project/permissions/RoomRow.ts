// Import Third-party Dependencies
import {
  JOIN_EVENT,
  PRESENCE_EVENT,
  type CapabilityDeclaration,
  type Right
} from "@jolly-pixel/network/client";
import type { IconName } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { RoleRules } from "../RoleRules.ts";
import {
  ALL_RIGHTS,
  lowerRight,
  type PermissionRow,
  type PermissionRowInit,
  type ShownRight
} from "./PermissionRow.ts";

export interface RoomRowInit extends PermissionRowInit {
  readonly icon?: IconName;
  readonly capabilities?: readonly CapabilityDeclaration[];
}

export class RoomRow implements PermissionRow {
  readonly id: string;
  readonly label: string;
  readonly description: string | undefined;
  readonly icon: IconName | undefined;
  readonly options = ALL_RIGHTS;
  readonly keys: readonly string[];
  readonly capabilities: readonly CapabilityRow[];

  constructor(
    room: string,
    init: RoomRowInit
  ) {
    this.id = room;
    this.label = init.label;
    this.description = init.description;
    this.icon = init.icon;
    this.keys = [
      `${room}.${JOIN_EVENT}`,
      `${room}.${PRESENCE_EVENT}`
    ];
    this.capabilities = (init.capabilities ?? []).map(
      (declaration) => new CapabilityRow(this, declaration)
    );
  }

  joins(
    rules: RoleRules
  ): boolean {
    return rules.effective(`${this.id}.${JOIN_EVENT}`) === "write";
  }

  rightIn(
    rules: RoleRules
  ): ShownRight {
    if (!this.joins(rules)) {
      return "void";
    }
    if (this.capabilities.length === 0) {
      return rules.effective(`${this.id}.*`);
    }

    const rights = new Set(
      this.capabilities.map((capability) => capability.rightIn(rules))
    );

    return rights.size === 1 ? [...rights][0] : "mixed";
  }

  applyTo(
    rules: RoleRules,
    right: Right
  ): RoleRules {
    const prefix = `${this.id}.`;
    const own = [...rules]
      .map(({ pattern }) => pattern)
      .filter((pattern) => pattern.startsWith(prefix));
    const all = `${this.id}.*`;

    return rules.without(own).withExact(right === "read" ?
      {
        [`${this.id}.${JOIN_EVENT}`]: "write",
        [`${this.id}.${PRESENCE_EVENT}`]: "write",
        [all]: "read"
      } :
      { [all]: right }
    );
  }

  reachable(): boolean {
    return true;
  }
}

export class CapabilityRow implements PermissionRow {
  readonly id: string;
  readonly label: string;
  readonly description: string | undefined;
  readonly options = ALL_RIGHTS;
  readonly keys: readonly string[];

  #room: RoomRow;

  constructor(
    room: RoomRow,
    declaration: CapabilityDeclaration
  ) {
    this.id = `${room.id}:${declaration.name}`;
    this.label = declaration.label;
    this.description = undefined;
    this.keys = declaration.events.map((event) => `${room.id}.${event}`);
    this.#room = room;
  }

  rightIn(
    rules: RoleRules
  ): Right {
    return this.keys.reduce<Right>(
      (lowest, key) => lowerRight(lowest, rules.effective(key)),
      "write"
    );
  }

  applyTo(
    rules: RoleRules,
    right: Right
  ): RoleRules {
    return rules.withExact(
      Object.fromEntries(this.keys.map((key) => [key, right]))
    );
  }

  reachable(
    rules: RoleRules
  ): boolean {
    return this.#room.joins(rules);
  }
}
