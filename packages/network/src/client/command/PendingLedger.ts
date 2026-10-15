// Import Internal Dependencies
import type { ChangeOutbox } from "./CommandSync.ts";
import type { NetworkCommandHeader } from "../../sync/types.ts";

export interface LedgerEntry<TCommand extends NetworkCommandHeader> {
  readonly command: TCommand;
  sent: boolean;
  applied: boolean;
}

export class PendingLedger<TCommand extends NetworkCommandHeader> {
  #entries: LedgerEntry<TCommand>[] = [];
  #outbox: ChangeOutbox | null = null;

  get size(): number {
    return this.#entries.length;
  }

  get entries(): readonly LedgerEntry<TCommand>[] {
    return this.#entries;
  }

  keepIn(
    outbox: ChangeOutbox
  ): void {
    this.#outbox = outbox;
    this.#entries = outbox.restore().map((command) => {
      return {
        command: command as TCommand,
        sent: command.seq > 0,
        applied: false
      };
    });
  }

  add(
    entry: LedgerEntry<TCommand>
  ): void {
    this.#entries.push(entry);
    this.#outbox?.keep(entry.command);
  }

  markSent(
    entry: LedgerEntry<TCommand>,
    clientId: string | null,
    seq: number
  ): void {
    Object.assign(entry.command, {
      clientId,
      seq
    });
    entry.sent = true;
    this.#outbox?.keep(entry.command);
  }

  takeUnsent(): LedgerEntry<TCommand>[] {
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
    for (const { command } of acknowledged) {
      this.#outbox?.drop(command);
    }

    return acknowledged;
  }

  discard(
    entry: LedgerEntry<TCommand>
  ): void {
    this.#entries = this.#entries.filter((kept) => kept !== entry);
    this.#outbox?.drop(entry.command);
  }

  appliedCommands(): TCommand[] {
    return this.#entries
      .filter((entry) => entry.applied)
      .map((entry) => entry.command);
  }

  clear(): void {
    this.#entries = [];
    this.#outbox = null;
  }
}
