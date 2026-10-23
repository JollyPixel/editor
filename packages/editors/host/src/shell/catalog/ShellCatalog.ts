// Import Third-party Dependencies
import type {
  CatalogCommand,
  CatalogMessage,
  CatalogRoom,
  CatalogRoomSource
} from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import {
  CATALOG_OPEN_MESSAGE_TYPE,
  type CatalogOpenMessage,
  type CatalogPortMessage
} from "./protocol.ts";

type CatalogListener = (message: CatalogMessage) => void;

export class ShellCatalog implements CatalogRoomSource {
  readonly #connector: MessagePort;

  constructor(
    connector: MessagePort
  ) {
    this.#connector = connector;
  }

  room(
    _name: string
  ): CatalogRoom {
    return new ShellCatalogRoom(this.#connector);
  }
}

class ShellCatalogRoom implements CatalogRoom {
  readonly #connector: MessagePort;
  readonly #listeners = new Set<CatalogListener>();
  #port: MessagePort | null = null;

  constructor(
    connector: MessagePort
  ) {
    this.#connector = connector;
  }

  on(
    _type: "message",
    listener: CatalogListener
  ): void {
    this.#listeners.add(listener);
  }

  off(
    _type: "message",
    listener: CatalogListener
  ): void {
    this.#listeners.delete(listener);
  }

  join(): void {
    if (this.#port !== null) {
      return;
    }

    const channel = new MessageChannel();
    this.#port = channel.port1;
    this.#port.addEventListener(
      "message",
      (event: MessageEvent<CatalogMessage>) => {
        for (const listener of this.#listeners) {
          listener(event.data);
        }
      }
    );
    this.#port.start();
    this.#connector.postMessage(
      { type: CATALOG_OPEN_MESSAGE_TYPE } satisfies CatalogOpenMessage,
      [channel.port2]
    );
  }

  send(
    command: CatalogCommand
  ): void {
    this.#post({
      type: "command",
      command
    });
  }

  leave(): void {
    this.#post({
      type: "leave"
    });
    this.#port?.close();
    this.#port = null;
  }

  #post(
    message: CatalogPortMessage
  ): void {
    this.#port?.postMessage(message);
  }
}
