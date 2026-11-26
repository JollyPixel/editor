// Import Third-party Dependencies
import type {
  Peer,
  PeerMetadata,
  Right,
  Room,
  RoomEventMap,
  RoomRights
} from "@jolly-pixel/network/client";

// CONSTANTS
const kGolem = "golem";
const kPerson = "person";

type RoomEvents = RoomEventMap<unknown>;

export interface TestAssetServer {
  connect(
    clientId: string
  ): Promise<void>;
  receive(
    clientId: string,
    payload: unknown
  ): Promise<void>;
  resync(
    clientId: string
  ): Promise<void>;
  take(
    clientId: string
  ): unknown[];
}

export class TestRoom implements Room {
  readonly id: string;
  readonly clientId = kGolem;
  readonly peers = new Map<string, Peer>();
  readonly profile: PeerMetadata = {};
  readonly role = "member";
  readonly rights: RoomRights = {};
  right: Right = "write";
  readonly sent: unknown[] = [];
  readonly presence: PeerMetadata = {};

  #server: TestAssetServer;
  #listeners = new Map<keyof RoomEvents, Set<RoomEvents[keyof RoomEvents]>>();
  #exchanges = Promise.resolve();
  #held: unknown[] | null = null;
  #personSeq = 0;

  constructor(
    id: string,
    server: TestAssetServer
  ) {
    this.id = id;
    this.#server = server;
  }

  can(): Right {
    return this.right;
  }

  join(): void {
    this.#exchange(() => this.#server.connect(kGolem));
  }

  send(
    payload: unknown
  ): void {
    this.sent.push(payload);
    if (this.#held === null) {
      this.#exchange(() => this.#server.receive(kGolem, payload));
    }
    else {
      this.#held.push(payload);
    }
  }

  updatePresence(
    patch: PeerMetadata
  ): void {
    Object.assign(this.presence, patch);
  }

  resync(): void {
    this.#exchange(() => this.#server.resync(kGolem));
  }

  resumeWith(): void {
    return;
  }

  leave(): void {
    return;
  }

  on<K extends keyof RoomEvents>(
    type: K,
    listener: RoomEvents[K]
  ): void {
    const listeners = this.#listeners.get(type);
    if (listeners === undefined) {
      this.#listeners.set(type, new Set([listener]));
    }
    else {
      listeners.add(listener);
    }
  }

  off<K extends keyof RoomEvents>(
    type: K,
    listener: RoomEvents[K]
  ): void {
    this.#listeners.get(type)?.delete(listener);
  }

  holdAnswers(): void {
    this.#held ??= [];
  }

  answer(): Promise<void> {
    const held = this.#held ?? [];
    this.#held = null;
    for (const payload of held) {
      this.#exchange(() => this.#server.receive(kGolem, payload));
    }

    return this.#exchanges;
  }

  receive(
    command: object
  ): Promise<void> {
    this.#exchanges = this.#exchanges.then(async() => {
      if (this.#personSeq === 0) {
        await this.#server.connect(kPerson);
      }
      await this.#server.receive(kPerson, {
        ...command,
        clientId: kPerson,
        seq: ++this.#personSeq,
        timestamp: 0
      });
      this.#server.take(kPerson);
    });

    return this.#exchanges;
  }

  deny(
    event: string,
    reason: string
  ): void {
    this.#emit("denied", {
      event,
      reason
    });
  }

  addPeer(
    peer: Peer
  ): void {
    this.peers.set(peer.clientId, peer);
    this.#emit("peer-joined", {
      clientId: peer.clientId
    });
  }

  #exchange(
    step: () => Promise<void>
  ): void {
    this.#exchanges = this.#exchanges
      .then(step)
      .then(() => {
        for (const message of this.#server.take(kGolem)) {
          this.#emit("message", message);
        }
      });
  }

  #emit<K extends keyof RoomEvents>(
    type: K,
    ...args: Parameters<RoomEvents[K]>
  ): void {
    for (const listener of this.#listeners.get(type) ?? []) {
      Reflect.apply(listener, undefined, args);
    }
  }
}
