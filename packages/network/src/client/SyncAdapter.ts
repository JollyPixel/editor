// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { Room } from "./Room.ts";
import type {
  NetworkCommandHeader,
  NetworkServerMessage
} from "../sync/types.ts";

export type SyncAdapterEventMap = {
  ready: () => void;
  snapshot: () => void;
};

/**
 * Syncs local changes over a `Room` and ignores echoed commands.
 */
export abstract class SyncAdapter<
  Target,
  Event extends object,
  Command extends NetworkCommandHeader,
  Snapshot
> extends Emitter<SyncAdapterEventMap> {
  protected readonly room: Room<
    Command,
    NetworkServerMessage<Command, Snapshot>
  >;

  #target: Target | undefined;
  #previousHandler: ((event: Event) => void) | undefined;
  #seq = 0;
  #ready = false;
  #onMessage = (
    message: NetworkServerMessage<Command, Snapshot>
  ): void => {
    this.#handleMessage(message);
  };

  constructor(
    room: Room<Command, NetworkServerMessage<Command, Snapshot>>
  ) {
    super();
    this.room = room;
    this.room.on(
      "message", this.#onMessage
    );
  }

  get ready(): boolean {
    return this.#ready;
  }

  attach(
    target: Target
  ): void {
    if (this.#target) {
      throw new Error("A target is already attached to this session");
    }

    this.#target = target;
    this.#previousHandler = this.getHandler(target);
    this.setHandler(target, (event) => {
      this.#previousHandler?.(event);
      this.room.send(
        this.stampCommand(event)
      );
    });
  }

  detach(): void {
    if (!this.#target) {
      return;
    }

    this.setHandler(
      this.#target,
      this.#previousHandler
    );
    this.#previousHandler = undefined;
    this.#target = undefined;
  }

  destroy(): void {
    this.detach();
    this.room.off(
      "message", this.#onMessage
    );
  }

  protected stampCommand(
    event: Event,
    timestamp?: number
  ): Command;
  /**
   * Stamps non-Event payloads without exposing `#seq`.
   */
  protected stampCommand<E extends object>(
    event: E,
    timestamp?: number
  ): E & NetworkCommandHeader;
  protected stampCommand(
    event: object,
    timestamp: number = Date.now()
  ): object {
    return {
      ...event,
      clientId: this.room.clientId,
      seq: ++this.#seq,
      timestamp
    };
  }

  protected abstract getHandler(
    target: Target
  ): ((event: Event) => void) | undefined;

  protected abstract setHandler(
    target: Target,
    fn: ((event: Event) => void) | undefined
  ): void;

  protected abstract applySnapshot(
    target: Target,
    snapshot: Snapshot
  ): void;

  protected abstract applyRemoteCommand(
    target: Target,
    command: Command
  ): void;

  #handleMessage(
    message: NetworkServerMessage<Command, Snapshot>
  ): void {
    switch (message.type) {
      case "snapshot":
        this.#handleSnapshot(message.data);
        break;
      case "command":
        this.#handleRemote(message.data);
        break;
    }
  }

  #handleRemote(
    command: Command
  ): void {
    if (command.clientId === this.room.clientId) {
      return;
    }

    if (this.#target) {
      this.applyRemoteCommand(this.#target, command);
    }
  }

  #handleSnapshot(
    snapshot: Snapshot
  ): void {
    if (this.#target) {
      this.applySnapshot(this.#target, snapshot);
    }

    // `ready` fires after the first sync.
    // `snapshot` fires after every full replacement.
    this.emit("snapshot");

    if (!this.#ready) {
      this.#ready = true;
      this.emit("ready");
    }
  }
}
