// Import Internal Dependencies
import type { NetworkCommandHeader } from "../../sync/types.ts";

// CONSTANTS
const kMaxHeldCommands = 500;
const kMaxHeldBytes = 2 * 1024 * 1024;

export interface LedgerEntry<TCommand extends NetworkCommandHeader> {
  readonly command: TCommand;
  sent: boolean;
  applied: boolean;
}

export class PendingLedger<TCommand extends NetworkCommandHeader> {
  #entries: LedgerEntry<TCommand>[] = [];
  #heldBytes = 0;
  #overflowed = false;

  get size(): number {
    return this.#entries.length;
  }

  get overflowed(): boolean {
    return this.#overflowed;
  }

  get entries(): readonly LedgerEntry<TCommand>[] {
    return this.#entries;
  }

  add(
    entry: LedgerEntry<TCommand>
  ): void {
    this.#entries.push(entry);
  }

  hold(
    entry: LedgerEntry<TCommand>,
    body: unknown
  ): boolean {
    this.#entries.push(entry);
    this.#heldBytes += JSON.stringify(body).length;
    if (
      this.#entries.length > kMaxHeldCommands ||
      this.#heldBytes > kMaxHeldBytes
    ) {
      this.#overflowed = true;
    }

    return this.#overflowed;
  }

  takeUnsent(): LedgerEntry<TCommand>[] {
    this.#heldBytes = 0;

    return this.#entries.filter((entry) => !entry.sent);
  }

  markUnsent(): void {
    for (const entry of this.#entries) {
      entry.sent = false;
    }
  }

  acknowledge(
    clientId: string | null,
    seq: number
  ): LedgerEntry<TCommand>[] {
    let remaining = this.#entries.findIndex(
      (entry) => !entry.sent ||
        entry.command.clientId !== clientId ||
        entry.command.seq > seq
    );
    if (remaining === -1) {
      remaining = this.#entries.length;
    }
    const acknowledged = this.#entries.slice(0, remaining);
    this.#entries = this.#entries.slice(remaining);

    return acknowledged;
  }

  appliedCommands(): TCommand[] {
    return this.#entries
      .filter((entry) => entry.applied)
      .map((entry) => entry.command);
  }

  clear(): void {
    this.#entries = [];
    this.#heldBytes = 0;
    this.#overflowed = false;
  }
}
