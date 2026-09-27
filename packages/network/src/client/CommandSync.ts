// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { Room } from "./Room.ts";
import type {
  NetworkCommandHeader,
  NetworkServerMessage,
  NetworkServerNoticeOf
} from "../sync/types.ts";

export type CommandBody<TCommand extends NetworkCommandHeader> =
  TCommand extends unknown ?
    Omit<TCommand, keyof NetworkCommandHeader> :
    never;

type SyncMessage<TCommand, TSnapshot> =
  | { type: "snapshot"; data: TSnapshot; }
  | { type: "command"; data: TCommand; };

interface PendingCommand<TCommand extends NetworkCommandHeader> {
  body: CommandBody<TCommand>;
  timestamp: number;
}

function isSyncMessage<TCommand, TSnapshot>(
  message: { type: string; }
): message is SyncMessage<TCommand, TSnapshot> {
  return message.type === "snapshot" || message.type === "command";
}

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
  TNotice extends NetworkServerNoticeOf<TNotice> = never
> extends Emitter<CommandSyncEventMap<TCommand, TSnapshot, TNotice>> {
  readonly room: Room<
    TCommand,
    NetworkServerMessage<TCommand, TSnapshot, TNotice>
  >;

  #seq = 0;
  #ready = false;
  #pending: PendingCommand<TCommand>[] = [];

  #onMessage = (
    message: NetworkServerMessage<TCommand, TSnapshot, TNotice>
  ): void => {
    if (!isSyncMessage<TCommand, TSnapshot>(message)) {
      this.emit("notice", message);

      return;
    }

    if (message.type === "snapshot") {
      this.#handleSnapshot(message.data);
    }
    else {
      this.#handleCommand(message.data);
    }
  };

  #onSync = (): void => {
    const pending = this.#pending;
    this.#pending = [];
    for (const { body, timestamp } of pending) {
      this.send(body, timestamp);
    }
  };

  constructor(
    room: Room<TCommand, NetworkServerMessage<TCommand, TSnapshot, TNotice>>
  ) {
    super();
    this.room = room;
    this.room.on("message", this.#onMessage);
    this.room.on("sync", this.#onSync);
  }

  get ready(): boolean {
    return this.#ready;
  }

  send(
    body: CommandBody<TCommand>,
    timestamp: number = Date.now()
  ): void {
    const clientId = this.room.clientId;
    if (clientId === null) {
      this.#pending.push({
        body,
        timestamp
      });

      return;
    }

    this.room.send({
      ...body,
      clientId,
      seq: ++this.#seq,
      timestamp
    } as unknown as TCommand);
  }

  destroy(): void {
    this.room.off("message", this.#onMessage);
    this.room.off("sync", this.#onSync);
    this.#pending = [];
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
