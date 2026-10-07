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
  imageOf(
    command: TCommand
  ): TImage;
  inverseOf(
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
> extends Emitter<CommandDocumentEvents<TCommand, TImage>> {
  readonly receipts = new ChangeReceipts<CommandChange<TCommand, TImage>>();

  #state: CommandState<TCommand, TSnapshot, TImage>;

  constructor(
    state: CommandState<TCommand, TSnapshot, TImage>
  ) {
    super();
    this.#state = state;
  }

  apply(
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
    this.emit("reset", cause);
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
        this.#state.inverseOf(command),
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

    const change = changeOf(this.#state.imageOf(command));
    this.#state.apply(command);
    this.emit("change", change);

    return change;
  }
}
