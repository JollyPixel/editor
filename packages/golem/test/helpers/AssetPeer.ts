// Import Third-party Dependencies
import { AssetRoom } from "@jolly-pixel/asset";
import {
  Client,
  connectWebSocket,
  type Peer,
  type Room,
  type SyncedDocument
} from "@jolly-pixel/network/client";

export interface PeerDocumentKind<TSynced> {
  readonly kind: string;

  syncDocument(room: Room): TSynced;
}

export interface AssetPeerOptions<TSynced> {
  socketUrl: string;
  credential: string;
  assetId: string;
  documentKind: PeerDocumentKind<TSynced>;
}

export class AssetPeer<
  TSynced extends SyncedDocument<unknown>
> implements Disposable {
  static async join<TSynced extends SyncedDocument<unknown>>(
    options: AssetPeerOptions<TSynced>
  ): Promise<AssetPeer<TSynced>> {
    const { documentKind } = options;
    const client = new Client({
      reconnect: false,
      socket: () => connectWebSocket({
        url: options.socketUrl,
        credential: options.credential
      })
    });
    const room = client.room(
      new AssetRoom(documentKind.kind, options.assetId).toString()
    );
    const synced = documentKind.syncDocument(room);
    room.join();
    await synced.ready;

    return new AssetPeer(client, room, synced);
  }

  readonly room: Room;
  readonly synced: TSynced;

  #client: Client;

  constructor(
    client: Client,
    room: Room,
    synced: TSynced
  ) {
    this.#client = client;
    this.room = room;
    this.synced = synced;
  }

  peerNamed(
    username: string
  ): Peer | undefined {
    return [...this.room.peers.values()]
      .find((peer) => peer.profile.username === username);
  }

  until(
    check: () => boolean
  ): Promise<void> {
    const { promise, resolve } = Promise.withResolvers<void>();
    const events = ["message", "peer-joined", "peer-presence"] as const;
    const test = (): void => {
      if (check()) {
        for (const event of events) {
          this.room.off(event, test);
        }
        resolve();
      }
    };
    for (const event of events) {
      this.room.on(event, test);
    }
    test();

    return promise;
  }

  [Symbol.dispose](): void {
    this.synced.dispose();
    this.room.leave();
    this.#client.destroy();
  }
}
