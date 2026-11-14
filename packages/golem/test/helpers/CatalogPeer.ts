// Import Third-party Dependencies
import {
  CATALOG_ROOM,
  CatalogClient
} from "@jolly-pixel/asset-server/client";
import {
  Client,
  type PresenceChannel,
  type Room
} from "@jolly-pixel/network/client";
import type { OpenAssets } from "@jolly-pixel/server";
import { openAssetsChannel } from "@jolly-pixel/server/client";
import {
  signedInSocket,
  type Browser,
  type ServedBackend
} from "@jolly-pixel/server/testing";

export class CatalogPeer implements Disposable {
  static async join(
    backend: ServedBackend,
    account: Browser
  ): Promise<CatalogPeer> {
    const client = new Client({
      reconnect: false,
      socket: () => signedInSocket(backend.socketUrl, account)
    });
    const catalog = await CatalogClient.connect(client);

    return new CatalogPeer(client, catalog);
  }

  #client: Client;
  #catalog: CatalogClient;
  #room: Room;
  #openAssets: PresenceChannel<OpenAssets>;

  constructor(
    client: Client,
    catalog: CatalogClient
  ) {
    this.#client = client;
    this.#catalog = catalog;
    this.#room = client.room(CATALOG_ROOM);
    this.#openAssets = openAssetsChannel(this.#room);
  }

  findOpenAssets(
    username: string
  ): OpenAssets | undefined {
    for (const [clientId, peer] of this.#room.peers) {
      if (peer.profile.username === username) {
        return this.#openAssets.values.get(clientId);
      }
    }

    return undefined;
  }

  until(
    check: () => boolean
  ): Promise<void> {
    const channel = this.#openAssets;
    const { promise, resolve } = Promise.withResolvers<void>();
    function test(): void {
      if (check()) {
        channel.off("change", test);
        resolve();
      }
    }
    channel.on("change", test);
    test();

    return promise;
  }

  [Symbol.dispose](): void {
    this.#openAssets.destroy();
    this.#catalog.dispose();
    this.#client.destroy();
  }
}
