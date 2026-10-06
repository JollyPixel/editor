// Import Internal Dependencies
import type {
  CommandContext,
  ConsoleRegistry,
  Revert
} from "../registry/types.ts";
import { ConsoleInputError } from "./errors/ConsoleInputError.ts";

export interface MemberRevertEntry {
  readonly kind: "command" | "variable";
  readonly address: string;
  readonly line: string;
  readonly revert: Revert;
}

export interface ScriptRevertEntry {
  readonly kind: "script";
  readonly addresses: readonly string[];
  readonly line: string;
  readonly revert: Revert;
}

export type RevertEntry = MemberRevertEntry | ScriptRevertEntry;

export class RevertStack {
  static readonly DEFAULT_CAPACITY = 100;

  readonly capacity: number;

  #registry: ConsoleRegistry;
  #entries: RevertEntry[] = [];

  constructor(
    registry: ConsoleRegistry,
    capacity = RevertStack.DEFAULT_CAPACITY
  ) {
    this.#registry = registry;
    this.capacity = capacity;
  }

  get size(): number {
    return this.#entries.length;
  }

  push(
    entry: RevertEntry
  ): void {
    this.#entries.push(entry);
    if (this.#entries.length > this.capacity) {
      this.#entries.shift();
    }
  }

  async revert(
    count: number,
    ctx: CommandContext
  ): Promise<void> {
    if (!Number.isInteger(count) || count < 1) {
      throw new ConsoleInputError(
        `Expected a positive whole number, got ${count}`
      );
    }

    let reverted = 0;
    while (reverted < count) {
      const entry = this.#entries.pop();
      if (entry === undefined) {
        break;
      }
      if (!this.#isRegistered(entry)) {
        ctx.error(
          `Skipped ${entry.line}: ${target(entry)} no longer registered`
        );
        continue;
      }

      try {
        await entry.revert();
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.error(`Could not revert ${entry.line}: ${message}`);

        return;
      }
      reverted++;
      ctx.print(`Reverted ${entry.line}`);
    }

    if (reverted === 0) {
      ctx.print("Nothing to revert");
    }
    else if (reverted < count) {
      ctx.print(`Reverted ${reverted} of ${count}`);
    }
  }

  #isRegistered(
    entry: RevertEntry
  ): boolean {
    switch (entry.kind) {
      case "command":
        return this.#registry.resolveCommand(entry.address) !== undefined;
      case "variable":
        return this.#registry.resolveVariable(entry.address) !== undefined;
      default:
        return entry.addresses.some(
          (address) => this.#registry.resolveVariable(address) !== undefined
        );
    }
  }
}

function target(
  entry: RevertEntry
): string {
  switch (entry.kind) {
    case "command":
      return `/${entry.address} is`;
    case "variable":
      return `${entry.address} is`;
    default:
      return "its variables are";
  }
}
