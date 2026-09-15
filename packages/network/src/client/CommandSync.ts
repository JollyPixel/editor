// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { Room } from "./Room.ts";
import type {
  NetworkCommandHeader,
  NetworkServerMessage,
  NetworkServerNotice
} from "../sync/types.ts";

export type CommandBody<TCommand extends NetworkCommandHeader> =
  TCommand extends unknown ?
    Omit<TCommand, keyof NetworkCommandHeader> :
    never;

type SyncMessage<TCommand, TSnapshot> =
  | { type: "snapshot"; data: TSnapshot; }
  | { type: "command"; data: TCommand; };

export type CommandSyncEventMap<
  TCommand,
  TSnapshot,
  TNotice
> = {
  ready: () => void;
  snapshot: (snapshot: TSnapshot) => void;
  command: (command: TCommand) => void;
  notice: (notice: TNotice) => void;
};

export class CommandSync<
  TCommand extends NetworkCommandHeader,
  TSnapshot,
  TNotice extends NetworkServerNotice = never
> extends Emitter<CommandSyncEventMap<TCommand, TSnapshot, TNotice>> {
  readonly room: Room<
    TCommand,
    NetworkServerMessage<TCommand, TSnapshot, TNotice>
  >;

  #seq = 0;
  #ready = false;

  #onMessage = (
    message: NetworkServerMessage<TCommand, TSnapshot, TNotice>
  ): void => {
    if (message.type !== "snapshot" && message.type !== "command") {
      this.emit("notice", message as TNotice);

      return;
    }

    const synced = message as SyncMessage<TCommand, TSnapshot>;
    if (synced.type === "snapshot") {
      this.#handleSnapshot(synced.data);
    }
    else {
      this.#handleCommand(synced.data);
    }
  };

  constructor(
    room: Room<TCommand, NetworkServerMessage<TCommand, TSnapshot, TNotice>>
  ) {
    super();
    this.room = room;
    this.room.on("message", this.#onMessage);
  }

  get ready(): boolean {
    return this.#ready;
  }

  send(
    body: CommandBody<TCommand>,
    timestamp: number = Date.now()
  ): void {
    this.room.send({
      ...body,
      clientId: this.room.clientId,
      seq: ++this.#seq,
      timestamp
    } as unknown as TCommand);
  }

  destroy(): void {
    this.room.off("message", this.#onMessage);
  }

  #handleCommand(
    command: TCommand
  ): void {
    if (command.clientId !== this.room.clientId) {
      this.emit("command", command);
    }
  }

  #handleSnapshot(
    snapshot: TSnapshot
  ): void {
    this.emit("snapshot", snapshot);

    if (!this.#ready) {
      this.#ready = true;
      this.emit("ready");
    }
  }
}
