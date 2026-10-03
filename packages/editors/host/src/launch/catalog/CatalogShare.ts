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

// Import Internal Dependencies
import type { EditorSessionClient } from "../../session/EditorSession.ts";
import {
  isCatalogOpenMessage,
  isCatalogPortMessage,
  type RelayedCommand
} from "./protocol.ts";

interface RelayRoom extends CatalogRoom {
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
      const port = this.#requests.get(message.requestId);
      this.#requests.delete(message.requestId);
      port?.postMessage(message);

      return;
    }

    for (const [port, shared] of this.#ports) {
      if (shared.live) {
        port.postMessage(message);
      }
    }
  };

  constructor(
    catalog: CatalogClient,
    room: RelayRoom
  ) {
    this.catalog = catalog;
    this.#room = room;
    this.#room.on("message", this.#relay);
  }

  /**
   * The returned function closes `connector` and every port opened through it.
   */
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
