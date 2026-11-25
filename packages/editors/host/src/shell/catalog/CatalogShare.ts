// Import Third-party Dependencies
import {
  CATALOG_APPLIED,
  CATALOG_REJECTED,
  CATALOG_ROOM,
  CatalogClient,
  type CatalogConnectOptions,
  type CatalogMessage,
  type CatalogRoom
} from "@jolly-pixel/asset-server/client";
import type {
  RoomRejectionEvent,
  RoomRights
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { EditorSessionClient } from "../../lease/AssetLeases.ts";
import {
  CATALOG_DENIED_MESSAGE_TYPE,
  CATALOG_RIGHTS_MESSAGE_TYPE,
  isCatalogOpenMessage,
  isCatalogPortMessage,
  type CatalogDeniedMessage,
  type CatalogRightsMessage,
  type RelayedCommand
} from "./protocol.ts";

interface RelayRoom extends CatalogRoom {
  readonly rights: RoomRights;
  send(command: RelayedCommand): void;
}

interface SharedPort {
  live: boolean;
  readonly listening: AbortController;
}

export class CatalogShare {
  static async open(
    client: EditorSessionClient,
    options: CatalogConnectOptions = {}
  ): Promise<CatalogShare> {
    const room: RelayRoom = client.room(CATALOG_ROOM);
    try {
      const catalog = await CatalogClient.connect(
        {
          room: () => room
        },
        options
      );

      return new CatalogShare(catalog, room);
    }
    catch (error) {
      client.destroy();

      throw error;
    }
  }

  readonly catalog: CatalogClient;
  readonly #room: RelayRoom;
  readonly #ports = new Map<MessagePort, SharedPort>();
  readonly #requests = new Map<string, MessagePort>();

  readonly #relay = (
    message: CatalogMessage
  ): void => {
    if (
      message.type === CATALOG_APPLIED ||
      message.type === CATALOG_REJECTED
    ) {
      this.#reply(message.requestId, message);

      return;
    }

    this.#broadcast(message);
  };

  readonly #shareRights = (): void => {
    this.#broadcast(this.#rightsMessage());
  };

  readonly #relayDenial = (
    denial: RoomRejectionEvent
  ): void => {
    if (denial.requestId !== undefined) {
      this.#reply(denial.requestId, {
        type: CATALOG_DENIED_MESSAGE_TYPE,
        denial
      } satisfies CatalogDeniedMessage);
    }
  };

  constructor(
    catalog: CatalogClient,
    room: RelayRoom
  ) {
    this.catalog = catalog;
    this.#room = room;
    this.#room.on("message", this.#relay);
    this.#room.on("rights", this.#shareRights);
    this.#room.on("denied", this.#relayDenial);
  }

  serve(
    connector: MessagePort
  ): () => void {
    const opened = new Set<MessagePort>();
    const listening = new AbortController();
    connector.addEventListener("message", (event) => {
      const [port] = event.ports;
      if (port !== undefined && isCatalogOpenMessage(event.data)) {
        opened.add(port);
        this.#attach(port);
      }
    }, { signal: listening.signal });
    connector.start();

    return () => {
      listening.abort();
      connector.close();
      for (const port of opened) {
        this.#detach(port);
      }
    };
  }

  dispose(): void {
    this.#room.off("message", this.#relay);
    this.#room.off("rights", this.#shareRights);
    this.#room.off("denied", this.#relayDenial);
    for (const port of [...this.#ports.keys()]) {
      this.#detach(port);
    }
    this.catalog.dispose();
  }

  #attach(
    port: MessagePort
  ): void {
    const shared: SharedPort = {
      live: false,
      listening: new AbortController()
    };
    this.#ports.set(port, shared);
    port.addEventListener("message", (event) => {
      this.#receive(port, event.data);
    }, { signal: shared.listening.signal });
    port.start();

    void this.catalog.ready.then(() => {
      if (this.#ports.get(port) === shared) {
        port.postMessage(this.#rightsMessage());
        port.postMessage(this.catalog.toSnapshot());
        shared.live = true;
      }
    });
  }

  #receive(
    port: MessagePort,
    data: unknown
  ): void {
    if (!isCatalogPortMessage(data)) {
      return;
    }

    if (data.type === "leave") {
      this.#detach(port);
    }
    else {
      this.#requests.set(data.command.requestId, port);
      this.#room.send(data.command);
    }
  }

  #reply(
    requestId: string,
    message: CatalogMessage | CatalogDeniedMessage
  ): void {
    const port = this.#requests.get(requestId);
    this.#requests.delete(requestId);
    port?.postMessage(message);
  }

  #broadcast(
    message: CatalogMessage | CatalogRightsMessage
  ): void {
    for (const [port, shared] of this.#ports) {
      if (shared.live) {
        port.postMessage(message);
      }
    }
  }

  #rightsMessage(): CatalogRightsMessage {
    return {
      type: CATALOG_RIGHTS_MESSAGE_TYPE,
      rights: {
        ...this.#room.rights
      }
    };
  }

  #detach(
    port: MessagePort
  ): void {
    const shared = this.#ports.get(port);
    if (shared === undefined) {
      return;
    }

    this.#ports.delete(port);
    shared.listening.abort();
    for (const [requestId, owner] of this.#requests) {
      if (owner === port) {
        this.#requests.delete(requestId);
      }
    }
    port.close();
  }
}
