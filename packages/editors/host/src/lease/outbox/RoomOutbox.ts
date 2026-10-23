// Import Third-party Dependencies
import type {
  ChangeOutbox,
  NetworkCommandHeader
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type {
  KeptCommand,
  OutboxStore
} from "./OutboxStore.ts";

export interface RoomOutboxOptions {
  room: string;
  store: OutboxStore;
  kept: Iterable<KeptCommand>;
}

export class RoomOutbox implements ChangeOutbox {
  readonly #room: string;
  readonly #store: OutboxStore;
  readonly #refs = new Map<NetworkCommandHeader, string>();

  constructor(
    options: RoomOutboxOptions
  ) {
    this.#room = options.room;
    this.#store = options.store;
    for (const { ref, command } of options.kept) {
      this.#refs.set(command, ref);
    }
  }

  restore(): NetworkCommandHeader[] {
    return [...this.#refs.keys()];
  }

  keep(
    command: NetworkCommandHeader
  ): void {
    const ref = this.#refs.get(command) ?? crypto.randomUUID();
    this.#refs.set(command, ref);
    this.#store.keep(this.#room, {
      ref,
      command: structuredClone(command)
    });
  }

  drop(
    command: NetworkCommandHeader
  ): void {
    const ref = this.#refs.get(command);
    if (ref !== undefined) {
      this.#refs.delete(command);
      this.#store.drop(ref);
    }
  }
}
