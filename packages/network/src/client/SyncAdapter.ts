// Import Internal Dependencies
import type { Room } from "./Room.ts";
import type {
  NetworkCommandHeader,
  NetworkServerMessage
} from "../types.ts";

/**
 * Syncs a local target over a `Room`,
 * stamping mutations with `clientId`/`seq`/`timestamp` and echo-guarding remote commands.
 **/
export abstract class SyncAdapter<
  Target,
  Event extends object,
  Command extends NetworkCommandHeader,
  Snapshot
> extends EventTarget {
  protected readonly room: Room<
    Command,
    NetworkServerMessage<Command, Snapshot>
  >;

  #target: Target | undefined;
  #previousHandler: ((event: Event) => void) | undefined;
  #seq = 0;
  #ready = false;
  #onMessage = (
    event: CustomEvent<NetworkServerMessage<Command, Snapshot>>
  ): void => {
    this.#handleMessage(event.detail);
  };

  constructor(
    room: Room<Command, NetworkServerMessage<Command, Snapshot>>
  ) {
    super();
    this.room = room;
    this.room.addEventListener(
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
    this.room.removeEventListener(
      "message", this.#onMessage
    );
  }

  protected stampCommand(
    event: Event,
    timestamp: number = Date.now()
  ): Command {
    return {
      ...event,
      clientId: this.room.clientId,
      seq: ++this.#seq,
      timestamp
    } as unknown as Command;
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
    cmd: Command
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
    cmd: Command
  ): void {
    if (cmd.clientId === this.room.clientId) {
      return;
    }

    if (this.#target) {
      this.applyRemoteCommand(this.#target, cmd);
    }
  }

  #handleSnapshot(
    snapshot: Snapshot
  ): void {
    if (this.#target) {
      this.applySnapshot(this.#target, snapshot);
    }

    if (!this.#ready) {
      this.#ready = true;
      this.dispatchEvent(
        new Event("ready")
      );
    }
  }
}
