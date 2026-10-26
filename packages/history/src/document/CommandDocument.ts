// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { ChangeReceipts } from "./ChangeReceipts.ts";
import { CommandChange } from "./CommandChange.ts";

export interface CommandState<TCommand, TSnapshot, TImage> {
  accepts(
    command: TCommand
  ): boolean;
  placeable(
    command: TCommand
  ): TCommand;
  apply(
    command: TCommand
  ): void;
  load(
    snapshot: TSnapshot
  ): void;
  captureImage(
    command: TCommand
  ): TImage;
  invert(
    command: TCommand
  ): TCommand[];
  restored(
    images: readonly TImage[]
  ): TSnapshot;
}

export type DocumentResetCause = "load" | "rewind";

export type CommandDocumentEvents<TCommand, TImage> = {
  change: (
    change: CommandChange<TCommand, TImage>
  ) => void;
  reset: (
    cause: DocumentResetCause
  ) => void;
};

export class CommandDocument<
  TCommand,
  TSnapshot,
  TImage
> {
  readonly receipts = new ChangeReceipts<CommandChange<TCommand, TImage>>();

  #events = new Emitter<CommandDocumentEvents<TCommand, TImage>>();
  #state: CommandState<TCommand, TSnapshot, TImage>;

  constructor(
    state: CommandState<TCommand, TSnapshot, TImage>
  ) {
    this.#state = state;
  }

  on<TEvent extends keyof CommandDocumentEvents<TCommand, TImage>>(
    event: TEvent,
    listener: CommandDocumentEvents<TCommand, TImage>[TEvent]
  ): this {
    this.#events.on(event, listener);

    return this;
  }

  off<TEvent extends keyof CommandDocumentEvents<TCommand, TImage>>(
    event: TEvent,
    listener: CommandDocumentEvents<TCommand, TImage>[TEvent]
  ): this {
    this.#events.off(event, listener);

    return this;
  }

  subscribe<TEvent extends keyof CommandDocumentEvents<TCommand, TImage>>(
    event: TEvent,
    listener: CommandDocumentEvents<TCommand, TImage>[TEvent]
  ): () => void {
    return this.#events.subscribe(event, listener);
  }

  applyRemote(
    command: TCommand,
    clientId: string | null = null
  ): boolean {
    return this.#change(
      command,
      (image) => CommandChange.remote(command, image, clientId)
    ) !== null;
  }

  replayPending(
    command: TCommand
  ): CommandChange<TCommand, TImage> | null {
    return this.#change(
      command,
      (image) => CommandChange.replay(command, image)
    );
  }

  applyStep(
    command: TCommand,
    basis: number | undefined
  ): CommandChange<TCommand, TImage> | null {
    return this.#local(this.#state.placeable(command), basis);
  }

  revert(
    images: readonly TImage[]
  ): void {
    if (images.length > 0) {
      this.#reset(this.#state.restored(images), "rewind");
    }
  }

  load(
    snapshot: TSnapshot
  ): void {
    this.#reset(snapshot, "load");
  }

  protected commit(
    command: TCommand
  ): boolean {
    return this.#local(command, undefined) !== null;
  }

  #reset(
    snapshot: TSnapshot,
    cause: DocumentResetCause
  ): void {
    this.#state.load(snapshot);
    this.#events.emit("reset", cause);
  }

  #local(
    command: TCommand,
    basis: number | undefined
  ): CommandChange<TCommand, TImage> | null {
    return this.#change(
      command,
      (image) => CommandChange.local(
        command,
        image,
        this.#state.invert(command),
        basis
      )
    );
  }

  #change(
    command: TCommand,
    changeOf: (image: TImage) => CommandChange<TCommand, TImage>
  ): CommandChange<TCommand, TImage> | null {
    if (!this.#state.accepts(command)) {
      return null;
    }

    const change = changeOf(this.#state.captureImage(command));
    this.#state.apply(command);
    this.#events.emit("change", change);

    return change;
  }
}
