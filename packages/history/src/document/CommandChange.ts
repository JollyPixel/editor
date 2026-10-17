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
  readonly origin: CommandOrigin;
  readonly image: TImage;
  readonly inverse: readonly TCommand[];
  readonly clientId: string | null;
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
