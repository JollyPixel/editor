// Import Internal Dependencies
import type { CommandReconciler } from "./CommandReconciler.ts";
import type {
  LedgerEntry,
  PendingLedger
} from "./PendingLedger.ts";
import {
  supersedes,
  type ConflictRecord
} from "../../sync/supersedes.ts";
import type { NetworkCommandHeader } from "../../sync/types.ts";

interface KeyedEntry<TCommand extends NetworkCommandHeader> {
  readonly entry: LedgerEntry<TCommand>;
  readonly keys: ReadonlySet<string>;
}

export interface CommandIntegratorOptions<
  TCommand extends NetworkCommandHeader
> {
  ledger: PendingLedger<TCommand>;
  reconciler: CommandReconciler<TCommand>;
  apply: (command: TCommand) => void;
  resync: () => void;
  unreplayable: (entry: LedgerEntry<TCommand>) => void;
}

export class CommandIntegrator<TCommand extends NetworkCommandHeader> {
  #ledger: PendingLedger<TCommand>;
  #reconciler: CommandReconciler<TCommand>;
  #apply: (command: TCommand) => void;
  #resync: () => void;
  #unreplayable: (entry: LedgerEntry<TCommand>) => void;

  constructor(
    options: CommandIntegratorOptions<TCommand>
  ) {
    this.#ledger = options.ledger;
    this.#reconciler = options.reconciler;
    this.#apply = options.apply;
    this.#resync = options.resync;
    this.#unreplayable = options.unreplayable;
  }

  integrate(
    command: TCommand,
    version?: number
  ): void {
    if (this.#ledger.size === 0) {
      this.#apply(command);

      return;
    }

    const keys = this.#reconciler.keys(command);
    const pending = keys === null ? null : this.#keyedPending();
    if (keys === null || pending === null) {
      this.#rebase(command);
    }
    else {
      this.#integrateKeyed(command, keys, pending, version);
    }
  }

  replayPending(): void {
    for (const entry of [...this.#ledger.entries]) {
      try {
        entry.applied = this.#reconciler.replay(entry.command);
      }
      catch {
        this.#unreplayable(entry);
      }
    }
  }

  #keyedPending(): KeyedEntry<TCommand>[] | null {
    const pending: KeyedEntry<TCommand>[] = [];
    for (const entry of this.#ledger.entries) {
      const keys = entry.applied ? this.#reconciler.keys(entry.command) : null;
      if (keys === null) {
        return null;
      }
      pending.push({
        entry,
        keys: new Set(keys)
      });
    }

    return pending;
  }

  #integrateKeyed(
    command: TCommand,
    keys: readonly string[],
    pending: readonly KeyedEntry<TCommand>[],
    version: number | undefined
  ): void {
    const existing: ConflictRecord = version === undefined ?
      command :
      { ...command, version };
    const keep: number[] = [];
    const outliving = new Set<LedgerEntry<TCommand>>();
    keys.forEach((key, index) => {
      const winners = pending.filter(
        (keyed) => keyed.keys.has(key) &&
          supersedes(keyed.entry.command, existing)
      );
      if (winners.length === 0) {
        keep.push(index);
      }
      for (const winner of winners) {
        outliving.add(winner.entry);
      }
    });

    if (keep.length === keys.length) {
      this.#apply(command);

      return;
    }
    if (keep.length === 0) {
      return;
    }

    const narrowed = this.#reconciler.narrow(command, keep);
    if (narrowed !== null) {
      this.#apply(narrowed);

      return;
    }

    this.#apply(command);
    for (const entry of outliving) {
      entry.applied = this.#reconciler.replay(entry.command);
    }
  }

  #rebase(
    command: TCommand
  ): void {
    if (!this.#reconciler.revert(this.#ledger.appliedCommands())) {
      this.#resync();

      return;
    }

    this.#apply(command);
    this.replayPending();
  }
}
