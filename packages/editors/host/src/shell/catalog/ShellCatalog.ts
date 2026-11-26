// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type {
  CatalogCommand,
  CatalogMessage,
  CatalogRoom,
  CatalogRoomSource
} from "@jolly-pixel/asset-server/client";
import type {
  Right,
  RoomRejectionEvent,
  RoomRights
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import {
  CATALOG_DENIED_MESSAGE_TYPE,
  CATALOG_OPEN_MESSAGE_TYPE,
  CATALOG_RIGHTS_MESSAGE_TYPE,
  type CatalogDeniedMessage,
  type CatalogOpenMessage,
  type CatalogPortMessage,
  type CatalogRightsMessage
} from "./protocol.ts";

type ShellCatalogRoomEvents = {
  message: (message: CatalogMessage) => void;
  rights: () => void;
  denied: (denial: RoomRejectionEvent) => void;
};

type ShellMessage =
  | CatalogMessage
  | CatalogRightsMessage
  | CatalogDeniedMessage;

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

class ShellCatalogRoom extends Emitter<ShellCatalogRoomEvents>
  implements CatalogRoom {
  readonly #connector: MessagePort;
  #port: MessagePort | null = null;
  #rights: RoomRights = {};

  constructor(
    connector: MessagePort
  ) {
    super();
    this.#connector = connector;
  }

  can(
    event: string
  ): Right {
    return this.#rights[event] ?? "void";
  }

  join(): void {
    if (this.#port !== null) {
      return;
    }

    const channel = new MessageChannel();
    this.#port = channel.port1;
    this.#port.addEventListener(
      "message",
      (event: MessageEvent<ShellMessage>) => this.#receive(event.data)
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

  #receive(
    message: ShellMessage
  ): void {
    if (message.type === CATALOG_RIGHTS_MESSAGE_TYPE) {
      this.#rights = message.rights;
      this.emit("rights");
    }
    else if (message.type === CATALOG_DENIED_MESSAGE_TYPE) {
      this.emit("denied", message.denial);
    }
    else {
      this.emit("message", message);
    }
  }
}
