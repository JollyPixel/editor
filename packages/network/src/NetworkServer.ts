// Import Internal Dependencies
import type { NetworkPlugin } from "./NetworkPlugin.ts";
import { isNetworkEnvelope } from "./utils/envelope.ts";
import type { ClientHandle } from "./types.ts";

/**
 * Transport-agnostic multiplexer sitting between raw connections and
 * registered NetworkPlugin instances.
 */
export class NetworkServer {
  #plugins = new Map<string, NetworkPlugin>();
  #clients = new Map<string, ClientHandle>();
  #joinedNamespaces = new Map<string, Set<string>>();
  #membersByNamespace = new Map<string, Set<string>>();

  register(
    plugin: NetworkPlugin
  ): void {
    this.#plugins.set(
      plugin.namespace,
      plugin
    );
    plugin.attach?.(
      (payload) => this.#broadcastToNamespace(plugin.namespace, payload)
    );
  }

  handleConnect(
    client: ClientHandle
  ): void {
    this.#clients.set(client.id, client);
  }

  handleDisconnect(
    clientId: string
  ): void {
    const namespaces = this.#joinedNamespaces.get(clientId);
    if (namespaces) {
      for (const namespace of namespaces) {
        this.#leaveNamespace(clientId, namespace);
      }
      this.#joinedNamespaces.delete(clientId);
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

    const plugin = this.#plugins.get(raw.namespace);
    if (!plugin) {
      return;
    }

    switch (raw.kind) {
      case "join":
        this.#join(clientId, plugin);
        break;
      case "leave":
        this.#leave(clientId, plugin);
        break;
      case "message":
        if (this.#hasJoined(clientId, plugin.namespace)) {
          plugin.onMessage(clientId, raw.payload);
        }
        break;
    }
  }

  #join(
    clientId: string,
    plugin: NetworkPlugin
  ): void {
    const client = this.#clients.get(clientId);
    if (!client || this.#hasJoined(clientId, plugin.namespace)) {
      return;
    }

    // Broadcast before the new client is recorded as a member, so it never
    // receives a "peer-joined" about itself.
    this.#broadcastPeerEvent(
      plugin.namespace,
      "peer-joined",
      clientId
    );

    let namespaces = this.#joinedNamespaces.get(clientId);
    if (!namespaces) {
      namespaces = new Set();
      this.#joinedNamespaces.set(clientId, namespaces);
    }
    namespaces.add(plugin.namespace);

    let members = this.#membersByNamespace.get(plugin.namespace);
    if (!members) {
      members = new Set();
      this.#membersByNamespace.set(plugin.namespace, members);
    }
    members.add(clientId);

    plugin.onClientConnect(
      this.#scopeClient(client, plugin.namespace)
    );
  }

  #leave(
    clientId: string,
    plugin: NetworkPlugin
  ): void {
    if (!this.#hasJoined(clientId, plugin.namespace)) {
      return;
    }

    this.#joinedNamespaces
      .get(clientId)
      ?.delete(plugin.namespace);
    this.#leaveNamespace(clientId, plugin.namespace);
  }

  #leaveNamespace(
    clientId: string,
    namespace: string
  ): void {
    this.#membersByNamespace.get(namespace)?.delete(clientId);
    this.#broadcastPeerEvent(
      namespace,
      "peer-left",
      clientId
    );
    this.#plugins.get(namespace)?.onClientDisconnect(clientId);
  }

  #broadcastPeerEvent(
    namespace: string,
    kind: "peer-joined" | "peer-left",
    clientId: string
  ): void {
    const members = this.#membersByNamespace.get(namespace);
    if (!members) {
      return;
    }

    for (const memberId of members) {
      if (memberId === clientId) {
        continue;
      }

      this.#clients.get(memberId)?.send({
        namespace,
        kind,
        clientId
      });
    }
  }

  #hasJoined(
    clientId: string,
    namespace: string
  ): boolean {
    return this.#joinedNamespaces.get(clientId)?.has(
      namespace
    ) ?? false;
  }

  /**
   * Sends a payload to every client currently joined to `namespace`, wrapped
   * in the same envelope a scoped `client.send()` would produce — plugins
   * calling this via the function handed to `attach()` stay ignorant of the
   * multiplexing envelope, just like `onClientConnect`'s scoped client.
   */
  #broadcastToNamespace(
    namespace: string,
    payload: unknown
  ): void {
    const members = this.#membersByNamespace.get(namespace);
    if (!members) {
      return;
    }

    for (const memberId of members) {
      this.#clients.get(memberId)?.send({
        namespace,
        kind: "message",
        payload
      });
    }
  }

  /**
   * Wraps a raw client so a plugin's `send()` calls are auto-tagged with its
   * namespace — plugins stay ignorant of the multiplexing envelope.
   */
  #scopeClient(
    client: ClientHandle,
    namespace: string
  ): ClientHandle {
    return {
      id: client.id,
      send: (data) => client.send({
        namespace,
        kind: "message",
        payload: data
      })
    };
  }
}
