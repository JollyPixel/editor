// Import Internal Dependencies
import type { RightsTable } from "./RightsTable.ts";
import {
  JOIN_EVENT,
  PRESENCE_EVENT
} from "../../protocol/constants.ts";
import type {
  Right,
  RoomRights
} from "../../protocol/types.ts";

// CONSTANTS
const kMembershipEvents = new Set([
  JOIN_EVENT,
  PRESENCE_EVENT
]);

/**
 * Read-only view of a `RightsTable` bound to one extension namespace.
 */
export class RightsGate {
  #table: RightsTable;
  #namespace: string;
  #readOnly: boolean;
  #resolved = new Map<string, Map<string, Right>>();

  constructor(
    table: RightsTable,
    namespace: string,
    readOnly = false
  ) {
    this.#table = table;
    this.#namespace = namespace;
    this.#readOnly = readOnly;
  }

  get gated(): boolean {
    return this.#readOnly || this.#table.configured;
  }

  check(
    role: string,
    event: string
  ): Right {
    let byEvent = this.#resolved.get(role);
    if (byEvent === undefined) {
      byEvent = new Map();
      this.#resolved.set(role, byEvent);
    }

    let right = byEvent.get(event);
    if (right === undefined) {
      right = this.#lookup(role, event);
      byEvent.set(event, right);
    }

    return right;
  }

  #lookup(
    role: string,
    event: string
  ): Right {
    const right = this.#table.check(
      role,
      `${this.#namespace}.${event}`
    );
    if (
      this.#readOnly &&
      right === "write" &&
      !kMembershipEvents.has(event)
    ) {
      return "read";
    }

    return right;
  }

  canWrite(
    role: string,
    event: string
  ): boolean {
    return this.check(role, event) === "write";
  }

  resolve(
    role: string,
    events: Iterable<string>
  ): RoomRights {
    const rights: Record<string, Right> = {};
    for (const event of events) {
      rights[event] = this.check(role, event);
    }

    return rights;
  }
}
