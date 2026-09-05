// Import Third-party Dependencies
import type {
  Peer,
  PeerMetadata,
  Room,
  RoomEventMap
} from "@jolly-pixel/network/client";

/**
 * Room test double that serializes presence patches like the wire.
 */
export class FakeRoom<
  ClientMessage = unknown,
  ServerMessage = unknown
> implements Room<ClientMessage, ServerMessage> {
  readonly id: string;
  readonly clientId = "local-uuid-nobody-sees";
  readonly peers = new Map<string, Peer>();
  readonly patches: PeerMetadata[] = [];
  readonly sent: ClientMessage[] = [];

  #listeners = new Map<string, Set<(...args: any[]) => void>>();

  constructor(
    id = "three:test"
  ) {
    this.id = id;
  }

  get lastPatch(): PeerMetadata | undefined {
    return this.patches.at(-1);
  }

  join(): void {
    // No transport to join.
  }

  send(
    payload: ClientMessage
  ): void {
    this.sent.push(payload);
  }

  updatePresence(
    patch: PeerMetadata
  ): void {
    this.patches.push(JSON.parse(JSON.stringify(patch)));
  }

  leave(): void {
    this.peers.clear();
  }

  on<K extends keyof RoomEventMap<ServerMessage>>(
    type: K,
    listener: RoomEventMap<ServerMessage>[K]
  ): void {
    const set = this.#listeners.get(type) ?? new Set();
    set.add(listener as (...args: any[]) => void);
    this.#listeners.set(type, set);
  }

  off<K extends keyof RoomEventMap<ServerMessage>>(
    type: K,
    listener: RoomEventMap<ServerMessage>[K]
  ): void {
    this.#listeners.get(type)?.delete(listener as (...args: any[]) => void);
  }

  subscribedEvents(): string[] {
    return [...this.#listeners]
      .filter(([, listeners]) => listeners.size > 0)
      .map(([type]) => type)
      .sort();
  }

  emit<K extends keyof RoomEventMap<ServerMessage>>(
    type: K,
    event: Parameters<RoomEventMap<ServerMessage>[K]>[0]
  ): void {
    for (const listener of this.#listeners.get(type) ?? []) {
      listener(event);
    }
  }

  emitSync(
    ...clientIds: string[]
  ): void {
    this.emit("sync", { clientIds });
  }

  emitJoin(
    clientId: string
  ): void {
    this.emit("peer-joined", { clientId });
  }

  emitLeft(
    clientId: string
  ): void {
    this.emit("peer-left", { clientId });
  }

  emitPresence(
    clientId: string,
    patch: PeerMetadata
  ): void {
    this.emit("peer-presence", { clientId, patch });
  }

  addPeer(
    clientId: string,
    peer: Partial<Omit<Peer, "clientId">> = {}
  ): void {
    this.peers.set(clientId, {
      clientId,
      identity: peer.identity ?? {},
      presence: peer.presence ?? {}
    });
  }
}
