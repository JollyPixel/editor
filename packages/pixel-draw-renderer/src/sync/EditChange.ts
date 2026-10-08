export type EditOrigin = "local" | "remote" | "replay";

export interface EditSource<TCommand> {
  subscribe(
    event: "change",
    listener: (change: EditChange<TCommand>) => void
  ): () => void;
  subscribe(
    event: "reset",
    listener: (cause: "load") => void
  ): () => void;
  applyStep(
    command: TCommand
  ): EditChange<TCommand> | null;
}

export class EditChange<TCommand> {
  static local<TCommand>(
    command: TCommand,
    inverse: readonly TCommand[] = []
  ): EditChange<TCommand> {
    return new EditChange(command, "local", inverse, null);
  }

  static remote<TCommand>(
    command: TCommand,
    clientId: string | null = null
  ): EditChange<TCommand> {
    return new EditChange(command, "remote", [], clientId);
  }

  static replay<TCommand>(
    command: TCommand
  ): EditChange<TCommand> {
    return new EditChange(command, "replay", [], null);
  }

  readonly command: TCommand;
  /**
   * `replay` is this client's pending command re-applied after a peer's.
   */
  readonly origin: EditOrigin;
  /**
   * Commands that undo a local change; empty otherwise.
   */
  readonly inverse: readonly TCommand[];
  /**
   * The peer behind a remote change; `null` otherwise.
   */
  readonly clientId: string | null;

  private constructor(
    command: TCommand,
    origin: EditOrigin,
    inverse: readonly TCommand[],
    clientId: string | null
  ) {
    this.command = command;
    this.origin = origin;
    this.inverse = inverse;
    this.clientId = clientId;
  }
}
