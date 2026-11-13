// Import Third-party Dependencies
import {
  Client,
  type Peer
} from "@jolly-pixel/network/client";
import { AgentChatClient } from "@jolly-pixel/server/client";
import {
  signedInSocket,
  type Browser,
  type ServedBackend
} from "@jolly-pixel/server/testing";

export class ChatPeer implements Disposable {
  static async join(
    backend: ServedBackend,
    account: Browser
  ): Promise<ChatPeer> {
    const client = new Client({
      reconnect: false,
      socket: () => signedInSocket(backend.socketUrl, account)
    });
    const chat = AgentChatClient.join(client);
    await chat.ready;

    return new ChatPeer(client, chat);
  }

  readonly chat: AgentChatClient;

  #client: Client;

  constructor(
    client: Client,
    chat: AgentChatClient
  ) {
    this.#client = client;
    this.chat = chat;
  }

  peerNamed(
    username: string
  ): Peer | undefined {
    return [...this.chat.room.peers.values()]
      .find((peer) => peer.profile.username === username);
  }

  until(
    check: () => boolean
  ): Promise<void> {
    const { room } = this.chat;
    const { promise, resolve } = Promise.withResolvers<void>();
    const unsubscribe = this.chat.subscribe(test);
    function test(): void {
      if (check()) {
        unsubscribe();
        room.off("peer-joined", test);
        room.off("peer-presence", test);
        resolve();
      }
    }
    room.on("peer-joined", test);
    room.on("peer-presence", test);
    test();

    return promise;
  }

  [Symbol.dispose](): void {
    this.chat.dispose();
    this.#client.destroy();
  }
}
