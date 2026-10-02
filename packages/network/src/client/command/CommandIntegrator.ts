// Import Internal Dependencies
import type { CommandReconciler } from "./CommandReconciler.ts";
import type {
  LedgerEntry,
  PendingLedger
} from "./PendingLedger.ts";
import type {
  ConflictRecord,
  ConflictResolver
} from "../../sync/ConflictResolver.ts";
import type { NetworkCommandHeader } from "../../sync/types.ts";

interface KeyedEntry<TCommand extends NetworkCommandHeader> {
  readonly entry: LedgerEntry<TCommand>;
  readonly keys: ReadonlySet<string>;
}

export interface CommandIntegratorOptions<
  TCommand extends NetworkCommandHeader
> {
  ledger: PendingLedger<TCommand>;
  reconciler: CommandReconciler<TCommand> | null;
  resolver: ConflictResolver<TCommand>;
  apply: (command: TCommand) => void;
  resync: () => void;
}

export class CommandIntegrator<TCommand extends NetworkCommandHeader> {
  #ledger: PendingLedger<TCommand>;
  #reconciler: CommandReconciler<TCommand> | null;
  #resolver: ConflictResolver<TCommand>;
  #apply: (command: TCommand) => void;
  #resync: () => void;

  constructor(
    options: CommandIntegratorOptions<TCommand>
  ) {
    this.#ledger = options.ledger;
    this.#reconciler = options.reconciler;
    this.#resolver = options.resolver;
    this.#apply = options.apply;
    this.#resync = options.resync;
  }

  integrate(
    command: TCommand,
    version?: number
  ): void {
    const reconciler = this.#reconciler;
    if (reconciler === null || this.#ledger.size === 0) {
      this.#apply(command);

      return;
    }

    if (!this.#integrateKeyed(reconciler, command, version)) {
      this.#rebase(reconciler, command);
    }
  }

  integrateCorrection(
    correction: TCommand
  ): void {
    if (this.#reconciler === null) {
      this.#apply(correction);
      this.replayPending();

      return;
    }

    this.integrate(correction);
  }

  replayPending(): void {
    const reconciler = this.#reconciler;
    for (const entry of [...this.#ledger.entries]) {
      if (reconciler === null) {
        this.#apply(entry.command);
      }
      else {
        entry.applied = reconciler.replay(entry.command);
      }
    }
  }

  #integrateKeyed(
    reconciler: CommandReconciler<TCommand>,
    command: TCommand,
    version: number | undefined
  ): boolean {
    const keys = reconciler.keys(command);
    if (keys === null) {
      return false;
    }

    const pending: KeyedEntry<TCommand>[] = [];
    for (const entry of this.#ledger.entries) {
      const pendingKeys = entry.applied ? reconciler.keys(entry.command) : null;
      if (pendingKeys === null) {
        return false;
      }
      pending.push({
        entry,
        keys: new Set(pendingKeys)
      });
    }

    const existing: ConflictRecord = version === undefined ?
      command :
      { ...command, version };
    const keep: number[] = [];
    const outliving = new Set<LedgerEntry<TCommand>>();
    keys.forEach((key, index) => {
      const winners = pending.filter(
        (keyed) => this.#outlives(keyed, key, existing)
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
    }
    else if (keep.length > 0) {
      const narrowed = reconciler.narrow(command, keep);
      if (narrowed === null) {
        this.#apply(command);
        for (const entry of outliving) {
          entry.applied = reconciler.replay(entry.command);
        }
      }
      else {
        this.#apply(narrowed);
      }
    }

    return true;
  }

  #outlives(
    keyed: KeyedEntry<TCommand>,
    key: string,
    existing: ConflictRecord
  ): boolean {
    return keyed.keys.has(key) && this.#resolver.resolve({
      incoming: keyed.entry.command,
      existing
    }) === "accept";
  }

  #rebase(
    reconciler: CommandReconciler<TCommand>,
    command: TCommand
  ): void {
    if (!reconciler.revert(this.#ledger.appliedCommands())) {
      this.#resync();

      return;
    }

    this.#apply(command);
    this.replayPending();
  }
}
