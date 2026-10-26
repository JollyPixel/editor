export type CommandOrigin = "local" | "remote" | "replay";

export type CommandChangeInit<TCommand, TImage> =
  | {
    origin: "local";
    command: TCommand;
    image: TImage;
    inverse: readonly TCommand[];
    basis: number | undefined;
  }
  | {
    origin: "remote";
    command: TCommand;
    image: TImage;
    clientId: string | null;
  }
  | {
    origin: "replay";
    command: TCommand;
    image: TImage;
  };

export class CommandChange<TCommand, TImage> {
  static local<TCommand, TImage>(
    command: TCommand,
    image: TImage,
    inverse: readonly TCommand[] = [],
    basis?: number
  ): CommandChange<TCommand, TImage> {
    return new CommandChange({
      origin: "local",
      command,
      image,
      inverse,
      basis
    });
  }

  static remote<TCommand, TImage>(
    command: TCommand,
    image: TImage,
    clientId: string | null = null
  ): CommandChange<TCommand, TImage> {
    return new CommandChange({
      origin: "remote",
      command,
      image,
      clientId
    });
  }

  static replay<TCommand, TImage>(
    command: TCommand,
    image: TImage
  ): CommandChange<TCommand, TImage> {
    return new CommandChange({
      origin: "replay",
      command,
      image
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
    this.inverse = init.origin === "local" ? init.inverse : [];
    this.clientId = init.origin === "remote" ? init.clientId : null;
    this.basis = init.origin === "local" ? init.basis : undefined;
  }
}
