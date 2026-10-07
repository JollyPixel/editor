export type CommandOrigin = "local" | "remote" | "replay";

export interface CommandChangeInit<TCommand, TImage> {
  command: TCommand;
  origin: CommandOrigin;
  image: TImage;
  inverse: readonly TCommand[];
  clientId: string | null;
  basis: number | undefined;
}

export class CommandChange<TCommand, TImage> {
  static local<TCommand, TImage>(
    command: TCommand,
    image: TImage,
    inverse: readonly TCommand[] = [],
    basis?: number
  ): CommandChange<TCommand, TImage> {
    return new CommandChange({
      command,
      origin: "local",
      image,
      inverse,
      clientId: null,
      basis
    });
  }

  static remote<TCommand, TImage>(
    command: TCommand,
    image: TImage,
    clientId: string | null = null
  ): CommandChange<TCommand, TImage> {
    return new CommandChange({
      command,
      origin: "remote",
      image,
      inverse: [],
      clientId,
      basis: undefined
    });
  }

  static replay<TCommand, TImage>(
    command: TCommand,
    image: TImage
  ): CommandChange<TCommand, TImage> {
    return new CommandChange({
      command,
      origin: "replay",
      image,
      inverse: [],
      clientId: null,
      basis: undefined
    });
  }

  readonly command: TCommand;
  /**
   * `replay` is this client's pending command re-applied after a peer's.
   */
  readonly origin: CommandOrigin;
  /**
   * What the command replaced, read before it applied.
   */
  readonly image: TImage;
  /**
   * Empty unless the change is local.
   */
  readonly inverse: readonly TCommand[];
  /**
   * The peer behind a remote change; `null` otherwise.
   */
  readonly clientId: string | null;
  /**
   * For an undo or redo: the room version of the step it replays.
   */
  readonly basis: number | undefined;

  constructor(
    init: CommandChangeInit<TCommand, TImage>
  ) {
    this.command = init.command;
    this.origin = init.origin;
    this.image = init.image;
    this.inverse = init.inverse;
    this.clientId = init.clientId;
    this.basis = init.basis;
  }
}
