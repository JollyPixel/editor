// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type {
  Peer,
  PeerMetadata,
  Right,
  Room,
  RoomEventMap,
  RoomRights
} from "@jolly-pixel/network/client";

export class FakeRoom extends Emitter<RoomEventMap> implements Room {
  readonly id = "script:test";
  readonly clientId: string;
  readonly peers = new Map<string, Peer>();
  readonly profile: PeerMetadata;
  readonly role = "editor";
  readonly rights: RoomRights = {};
  readonly access: Right = "write";
  readonly sent: unknown[] = [];
  presence: PeerMetadata = {};

  #network: FakeNetwork;

  constructor(
    network: FakeNetwork,
    clientId: string
  ) {
    super();
    this.#network = network;
    this.clientId = clientId;
    this.profile = {
      username: clientId,
      peerId: clientId
    };
  }

  can(): Right {
    return this.access;
  }

  join(): void {
    return void 0;
  }

  send(
    payload: unknown
  ): void {
    this.sent.push(payload);
  }

  updatePresence(
    patch: PeerMetadata
  ): void {
    const wire: PeerMetadata = JSON.parse(JSON.stringify(patch));
    this.presence = {
      ...this.presence,
      ...wire
    };
    this.#network.deliver(this, wire);
  }

  resync(): void {
    return void 0;
  }

  resumeWith(): void {
    return void 0;
  }

  leave(): void {
    this.#network.disconnect(this);
  }

  asPeer(): Peer {
    return {
      clientId: this.clientId,
      role: this.role,
      profile: this.profile,
      presence: this.presence
    };
  }
}

export class FakeNetwork {
  #rooms: FakeRoom[] = [];
  #held: Array<() => void> | null = null;

  connect(
    clientId: string
  ): FakeRoom {
    const room = new FakeRoom(this, clientId);
    for (const other of this.#rooms) {
      other.peers.set(clientId, room.asPeer());
      other.emit("peer-joined", { clientId });
      room.peers.set(other.clientId, other.asPeer());
    }
    this.#rooms.push(room);

    return room;
  }

  disconnect(
    room: FakeRoom
  ): void {
    this.#rooms = this.#rooms.filter((other) => other !== room);
    for (const other of this.#rooms) {
      other.peers.delete(room.clientId);
      other.emit("peer-left", { clientId: room.clientId });
    }
  }

  hold(): void {
    this.#held = [];
  }

  flush(): void {
    const held = this.#held ?? [];
    this.#held = null;
    for (const delivery of held) {
      delivery();
    }
  }

  deliver(
    sender: FakeRoom,
    patch: PeerMetadata
  ): void {
    const delivery = (): void => {
      for (const other of this.#rooms) {
        if (other !== sender && other.peers.has(sender.clientId)) {
          other.peers.set(sender.clientId, sender.asPeer());
          other.emit("peer-presence", {
            clientId: sender.clientId,
            patch
          });
        }
      }
    };
    if (this.#held === null) {
      delivery();
    }
    else {
      this.#held.push(delivery);
    }
  }
}
