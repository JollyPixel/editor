// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

export type ConnectionEvent = "ready" | "disconnected";

export interface ServerConnection {
  readonly ready: boolean;

  on(
    event: ConnectionEvent,
    listener: () => void
  ): unknown;
  off(
    event: ConnectionEvent,
    listener: () => void
  ): unknown;
}

export interface UnsavedChanges {
  readonly unsaved: boolean;

  on(
    event: "unsaved",
    listener: () => void
  ): unknown;
  off(
    event: "unsaved",
    listener: () => void
  ): unknown;
}

export interface ConnectionStatusOptions {
  client: ServerConnection;
  changes: UnsavedChanges;
}

export class ConnectionStatus extends Emitter<{ change: () => void; }> {
  readonly #client: ServerConnection;
  readonly #changes: UnsavedChanges;
  #online: boolean;

  readonly #onReady = (): void => this.#update(true);
  readonly #onDisconnected = (): void => this.#update(false);
  readonly #onUnsaved = (): void => {
    if (!this.#online) {
      this.emit("change");
    }
  };

  constructor(
    options: ConnectionStatusOptions
  ) {
    super();

    this.#client = options.client;
    this.#changes = options.changes;
    this.#online = this.#client.ready;
    this.#client.on("ready", this.#onReady);
    this.#client.on("disconnected", this.#onDisconnected);
    this.#changes.on("unsaved", this.#onUnsaved);
  }

  get online(): boolean {
    return this.#online;
  }

  get unsaved(): boolean {
    return this.#changes.unsaved;
  }

  dispose(): void {
    this.#client.off("ready", this.#onReady);
    this.#client.off("disconnected", this.#onDisconnected);
    this.#changes.off("unsaved", this.#onUnsaved);
  }

  #update(
    online: boolean
  ): void {
    if (online !== this.#online) {
      this.#online = online;
      this.emit("change");
    }
  }
}
