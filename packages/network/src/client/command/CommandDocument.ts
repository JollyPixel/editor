// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { ChangeReceipts } from "../history/ChangeReceipts.ts";

export type CommandOrigin = "local" | "remote" | "replay";

export interface CommandChange<TCommand, TImage> {
  readonly command: TCommand;
  /** `replay` is this client's pending command re-applied after a peer's. */
  readonly origin: CommandOrigin;
  /** What the command replaced, read before it applied. */
  readonly image: TImage;
  /** Empty unless the change is local. */
  readonly inverse: readonly TCommand[];
  /** The peer behind a remote change; `null` otherwise. */
  readonly clientId: string | null;
  /** For an undo or redo: the room version of the step it replays. */
  readonly basis?: number;
}

export interface CommandState<TCommand, TSnapshot, TImage> {
  accepts(command: TCommand): boolean;
  placeable(command: TCommand): TCommand;
  apply(command: TCommand): void;
  load(snapshot: TSnapshot): void;
  imageOf(command: TCommand): TImage;
  inverseOf(command: TCommand): TCommand[];
  restored(images: readonly TImage[]): TSnapshot;
}

export type CommandDocumentEvents<TCommand, TImage> = {
  change: (change: CommandChange<TCommand, TImage>) => void;
  reset: () => void;
};

interface ChangeContext {
  clientId?: string | null;
  basis?: number;
}

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
    return this.#change(command, "remote", { clientId }) !== null;
  }

  replayPending(
    command: TCommand
  ): CommandChange<TCommand, TImage> | null {
    return this.#change(command, "replay");
  }

  applyStep(
    command: TCommand,
    basis: number | undefined
  ): CommandChange<TCommand, TImage> | null {
    return this.#change(
      this.#state.placeable(command),
      "local",
      basis === undefined ? {} : { basis }
    );
  }

  revert(
    images: readonly TImage[]
  ): void {
    if (images.length > 0) {
      this.load(this.#state.restored(images));
    }
  }

  load(
    snapshot: TSnapshot
  ): void {
    this.#state.load(snapshot);
    this.emit("reset");
  }

  protected commit(
    command: TCommand
  ): boolean {
    return this.#change(command, "local") !== null;
  }

  #change(
    command: TCommand,
    origin: CommandOrigin,
    context: ChangeContext = {}
  ): CommandChange<TCommand, TImage> | null {
    if (!this.#state.accepts(command)) {
      return null;
    }

    const image = this.#state.imageOf(command);
    const inverse = origin === "local" ? this.#state.inverseOf(command) : [];
    this.#state.apply(command);
    const change: CommandChange<TCommand, TImage> = {
      command,
      origin,
      image,
      inverse,
      clientId: context.clientId ?? null,
      ...context.basis === undefined ? {} : { basis: context.basis }
    };
    this.emit("change", change);

    return change;
  }
}
