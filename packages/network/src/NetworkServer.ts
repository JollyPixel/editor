// Import Internal Dependencies
import { NetworkServerNamespace } from "./NetworkServerNamespace.ts";
import { isNetworkEnvelope } from "./utils/envelope.ts";
import type { NetworkPlugin } from "./NetworkPlugin.ts";
import type { ClientHandle } from "./types.ts";

interface ClientRecord {
  handle: ClientHandle;
  namespaces: Set<string>;
}

/**
 * Transport-agnostic multiplexer sitting between raw connections and
 * registered NetworkPlugin instances.
 */
export class NetworkServer {
  #namespaces = new Map<string, NetworkServerNamespace>();
  #clients = new Map<string, ClientRecord>();

  register(
    plugin: NetworkPlugin
  ): void {
    const namespace = new NetworkServerNamespace(
      plugin,
      (clientId) => this.#clients.get(clientId)?.handle
    );
    this.#namespaces.set(plugin.namespace, namespace);
    plugin.attach?.(
      (payload) => namespace.broadcast(payload)
    );
  }

  handleConnect(
    client: ClientHandle
  ): void {
    this.#clients.set(client.id, {
      handle: client,
      namespaces: new Set()
    });
  }

  handleDisconnect(
    clientId: string
  ): void {
    const record = this.#clients.get(clientId);
    if (record) {
      for (const namespaceName of record.namespaces) {
        this.#namespaces.get(namespaceName)?.leave(clientId);
      }
    }

    this.#clients.delete(clientId);
  }

  handleMessage(
    clientId: string,
    raw: unknown
  ): void {
    if (!isNetworkEnvelope(raw)) {
      return;
    }

    const record = this.#clients.get(clientId);
    const namespace = this.#namespaces.get(raw.namespace);
    if (!record || !namespace) {
      return;
    }

    switch (raw.kind) {
      case "join":
        if (!record.namespaces.has(raw.namespace)) {
          record.namespaces.add(raw.namespace);
          namespace.join(
            clientId,
            record.handle,
            raw.identity ?? Object.create(null)
          );
        }
        break;
      case "leave":
        if (record.namespaces.delete(raw.namespace)) {
          namespace.leave(clientId);
        }
        break;
      case "message":
        if (this.#hasJoined(clientId, raw.namespace)) {
          namespace.message(
            clientId,
            raw.payload
          );
        }
        break;
      case "presence":
        if (this.#hasJoined(clientId, raw.namespace)) {
          namespace.updatePresence(
            clientId,
            raw.patch ?? Object.create(null)
          );
        }
        break;
    }
  }

  #hasJoined(
    clientId: string,
    namespace: string
  ): boolean {
    return this.#clients.get(clientId)?.namespaces.has(
      namespace
    ) ?? false;
  }
}
