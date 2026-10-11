// Import Third-party Dependencies
import {
  PresenceChannel,
  type Room
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type {
  LockState,
  PresenceSource
} from "../peer/PresenceSource.ts";
import type { CollaboratorPresence } from "../peer/types.ts";
import {
  localPresencePeer,
  toPresencePeer
} from "./peerProfile.ts";

// CONSTANTS
const kFieldLockKey = "fieldLock";
const kRosterEvents = [
  "sync",
  "left",
  "peer-joined",
  "peer-left",
  "peer-profile"
] as const;

export class RoomPresenceSource implements PresenceSource {
  #room: Room;
  #channel: PresenceChannel<string | null>;
  #peers: ReadonlyMap<string, CollaboratorPresence> | null = null;
  #listeners = new Set<() => void>();

  #invalidate = (): void => {
    this.#peers = null;
    for (const listener of this.#listeners) {
      listener();
    }
  };

  constructor(
    room: Room
  ) {
    this.#room = room;
    this.#channel = new PresenceChannel<string | null>(room, {
      key: kFieldLockKey,
      decode: (value) => (typeof value === "string" ? value : undefined)
    });

    this.#channel.on("change", this.#invalidate);
    for (const event of kRosterEvents) {
      room.on(event, this.#invalidate);
    }
  }

  get clientId(): string {
    return this.#room.clientId ?? "";
  }

  get peers(): ReadonlyMap<string, CollaboratorPresence> {
    this.#peers ??= this.#resolvePeers();

    return this.#peers;
  }

  claim(
    path: string
  ): LockState {
    const contended = [...this.#channel.values.values()].includes(path);
    this.#publish(path);

    return contended ? "contended" : "held";
  }

  release(
    path: string
  ): void {
    if (this.#channel.published === path) {
      this.#publish(null);
    }
  }

  on(
    _event: "change",
    listener: () => void
  ): void {
    this.#listeners.add(listener);
  }

  off(
    _event: "change",
    listener: () => void
  ): void {
    this.#listeners.delete(listener);
  }

  dispose(): void {
    for (const event of kRosterEvents) {
      this.#room.off(event, this.#invalidate);
    }
    this.#channel.off("change", this.#invalidate);
    this.#channel.destroy();
    this.#listeners.clear();
  }

  #publish(
    editing: string | null
  ): void {
    if (this.#channel.publish(editing)) {
      this.#invalidate();
    }
  }

  #resolvePeers(): ReadonlyMap<string, CollaboratorPresence> {
    const local = localPresencePeer(this.#room);
    const peers = new Map<string, CollaboratorPresence>([
      [local.clientId, withEditing(local, this.#channel.published ?? null)]
    ]);
    for (const peer of this.#room.peers.values()) {
      peers.set(peer.clientId, withEditing(
        toPresencePeer(peer),
        this.#channel.values.get(peer.clientId) ?? null
      ));
    }

    return peers;
  }
}

function withEditing(
  peer: CollaboratorPresence,
  editing: string | null
): CollaboratorPresence {
  return editing === null ? peer : { ...peer, editing };
}
