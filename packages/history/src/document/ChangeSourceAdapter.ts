// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { ChangeReceipts } from "./ChangeReceipts.ts";
import {
  CommandChange,
  type CommandOrigin
} from "./CommandChange.ts";
import type { DocumentResetCause } from "./CommandDocument.ts";
import type { HistorySource } from "../history/HistoryRegistration.ts";

export interface SourceChange<TCommand> {
  readonly command: TCommand;
  readonly origin: CommandOrigin;
  /**
   * Empty unless the change is local.
   */
  readonly inverse: readonly TCommand[];
  /**
   * The peer behind a remote change; `null` otherwise.
   */
  readonly clientId: string | null;
}

export interface ChangeSource<TCommand> {
  subscribe(
    event: "change",
    listener: (change: SourceChange<TCommand>) => void
  ): () => void;
  subscribe(
    event: "reset",
    listener: (cause: DocumentResetCause) => void
  ): () => void;
  applyStep(
    command: TCommand
  ): SourceChange<TCommand> | null;
}

export type ChangeSourceAdapterEvents<TCommand> = {
  change: (change: CommandChange<TCommand, null>) => void;
  reset: (cause: DocumentResetCause) => void;
};

export class ChangeSourceAdapter<TCommand>
implements HistorySource<TCommand, null> {
  readonly receipts = new ChangeReceipts<CommandChange<TCommand, null>>();

  #source: ChangeSource<TCommand>;
  #changes = new WeakMap<
    SourceChange<TCommand>,
    CommandChange<TCommand, null>
  >();
  #events = new Emitter<ChangeSourceAdapterEvents<TCommand>>();
  #basis: number | undefined = undefined;
  #releases: (() => void)[];

  constructor(
    source: ChangeSource<TCommand>
  ) {
    this.#source = source;
    this.#releases = [
      source.subscribe(
        "change",
        (change) => this.#events.emit("change", this.adapt(change))
      ),
      source.subscribe(
        "reset",
        (cause) => this.#events.emit("reset", cause)
      )
    ];
  }

  adapt(
    change: SourceChange<TCommand>
  ): CommandChange<TCommand, null> {
    let adapted = this.#changes.get(change);
    if (adapted === undefined) {
      adapted = new CommandChange({
        command: change.command,
        origin: change.origin,
        image: null,
        inverse: change.inverse,
        clientId: change.clientId,
        basis: change.origin === "local" ? this.#basis : undefined
      });
      this.#changes.set(change, adapted);
    }

    return adapted;
  }

  subscribe<TEvent extends keyof ChangeSourceAdapterEvents<TCommand>>(
    event: TEvent,
    listener: ChangeSourceAdapterEvents<TCommand>[TEvent]
  ): () => void {
    return this.#events.subscribe(event, listener);
  }

  applyStep(
    command: TCommand,
    basis: number | undefined
  ): CommandChange<TCommand, null> | null {
    const previous = this.#basis;
    this.#basis = basis;
    try {
      const change = this.#source.applyStep(command);

      return change === null ? null : this.adapt(change);
    }
    finally {
      this.#basis = previous;
    }
  }

  dispose(): void {
    for (const release of this.#releases.splice(0)) {
      release();
    }
    this.#events.removeAllListeners();
  }
}
