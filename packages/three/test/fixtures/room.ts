// Import Third-party Dependencies
import type {
  Peer,
  PeerMetadata,
  Right,
  Room,
  RoomEventMap,
  RoomRights
} from "@jolly-pixel/network/client";

export class FakeRoom implements Room {
  readonly id = "three:test";
  readonly clientId = "local-uuid-nobody-sees";
  readonly peers = new Map<string, Peer>();
  readonly patches: PeerMetadata[] = [];
  readonly role = "default";
  readonly rights: RoomRights = {};
  readonly access: Right = "write";

  #listeners = new Map<string, Set<(...args: any[]) => void>>();

  get lastPatch(): PeerMetadata | undefined {
    return this.patches.at(-1);
  }

  can(): Right {
    return this.access;
  }

  join(): void {
    return void 0;
  }

  send(): void {
    return void 0;
  }

  updatePresence(
    patch: PeerMetadata
  ): void {
    this.patches.push(JSON.parse(JSON.stringify(patch)));
  }

  resync(): void {
    return void 0;
  }

  resumeWith(): void {
    return void 0;
  }

  leave(): void {
    return void 0;
  }

  on<K extends keyof RoomEventMap>(
    type: K,
    listener: RoomEventMap[K]
  ): void {
    const set = this.#listeners.get(type) ?? new Set();
    set.add(listener as (...args: any[]) => void);
    this.#listeners.set(type, set);
  }

  off<K extends keyof RoomEventMap>(
    type: K,
    listener: RoomEventMap[K]
  ): void {
    this.#listeners.get(type)?.delete(listener as (...args: any[]) => void);
  }

  subscribedEvents(): string[] {
    return [...this.#listeners]
      .filter(([, listeners]) => listeners.size > 0)
      .map(([type]) => type)
      .sort();
  }

  emitSync(
    ...clientIds: string[]
  ): void {
    this.#emit("sync", {
      self: this.clientId,
      clientIds
    });
  }

  emitLeft(
    clientId: string
  ): void {
    this.peers.delete(clientId);
    this.#emit("peer-left", { clientId });
  }

  emitPresence(
    clientId: string,
    patch: PeerMetadata
  ): void {
    this.#emit("peer-presence", { clientId, patch });
  }

  addPeer(
    clientId: string,
    peer: Partial<Omit<Peer, "clientId">> = {}
  ): void {
    this.peers.set(clientId, {
      clientId,
      role: peer.role ?? "default",
      profile: peer.profile ?? {},
      presence: peer.presence ?? {}
    });
  }

  #emit<K extends keyof RoomEventMap>(
    type: K,
    event: Parameters<RoomEventMap[K]>[0]
  ): void {
    for (const listener of this.#listeners.get(type) ?? []) {
      listener(event);
    }
  }
}
