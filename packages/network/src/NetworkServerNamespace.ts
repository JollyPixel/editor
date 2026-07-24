// Import Internal Dependencies
import type { NetworkPlugin } from "./NetworkPlugin.ts";
import type {
  ClientHandle,
  NetworkEnvelope,
  PeerMetadata
} from "./types.ts";

interface PeerRecord {
  identity: PeerMetadata;
  presence: PeerMetadata;
}

type ResolveClient = (clientId: string) => ClientHandle | undefined;

export class NetworkServerNamespace {
  readonly name: string;

  #plugin: NetworkPlugin;
  #resolveClient: ResolveClient;
  #members = new Map<string, PeerRecord>();

  constructor(
    plugin: NetworkPlugin,
    resolveClient: ResolveClient
  ) {
    this.name = plugin.namespace;
    this.#plugin = plugin;
    this.#resolveClient = resolveClient;
  }

  join(
    clientId: string,
    client: ClientHandle,
    identity: PeerMetadata
  ): void {
    this.#send({
      namespace: this.name,
      kind: "peer-joined",
      clientId,
      identity
    }, clientId);

    if (this.#members.size > 0) {
      const members = [...this.#members].map(([memberId, record]) => {
        return {
          clientId: memberId,
          identity: record.identity,
          presence: record.presence
        };
      });

      client.send({
        namespace: this.name,
        kind: "sync",
        members
      });
    }

    this.#members.set(clientId, {
      identity,
      presence: {}
    });

    this.#plugin.onClientConnect(
      {
        id: client.id,
        send: (data) => client.send({
          namespace: this.name,
          kind: "message",
          payload: data
        })
      },
      identity
    );
  }

  leave(
    clientId: string
  ): void {
    this.#members.delete(clientId);
    this.#send({
      namespace: this.name,
      kind: "peer-left",
      clientId
    }, clientId);
    this.#plugin.onClientDisconnect(clientId);
  }

  updatePresence(
    clientId: string,
    patch: PeerMetadata
  ): void {
    const record = this.#members.get(clientId);
    if (!record) {
      return;
    }

    Object.assign(record.presence, patch);
    this.#send({
      namespace: this.name,
      kind: "peer-presence",
      clientId,
      patch
    }, clientId);
  }

  message(
    clientId: string,
    payload: unknown
  ): void {
    this.#plugin.onMessage(clientId, payload);
  }

  broadcast(
    payload: unknown
  ): void {
    this.#send({
      namespace: this.name,
      kind: "message",
      payload
    });
  }

  #send(
    envelope: NetworkEnvelope,
    excludeClientId?: string
  ): void {
    for (const memberId of this.#members.keys()) {
      if (memberId === excludeClientId) {
        continue;
      }

      this.#resolveClient(memberId)?.send(envelope);
    }
  }
}
