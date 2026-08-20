// Import Internal Dependencies
import type {
  Right,
  RightsTable
} from "./RightsTable.ts";

/**
 * Read-only view of a `RightsTable` bound to one extension namespace.
 */
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
    return this.#table.check(
      role,
      `${this.#namespace}.${event}`
    );
  }

  canWrite(
    role: string,
    event: string
  ): boolean {
    return this.check(role, event) === "write";
  }
}
