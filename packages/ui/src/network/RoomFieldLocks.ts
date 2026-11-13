// Import Third-party Dependencies
import {
  PEER_FIELD_LOCK_KEY,
  PresenceChannel,
  decodeString,
  type Room
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { FieldLockSource } from "../peer/lock/FieldLockSource.ts";
import {
  PeerMarks,
  type PeerMark
} from "../peer/PeerMarks.ts";
import type { PresencePeer } from "../peer/PresencePeer.ts";
import { roomPeers } from "./peerProfile.ts";

// CONSTANTS
const kSelfEvents = [
  "sync",
  "left",
  "peer-profile"
] as const;

export class RoomFieldLocks implements FieldLockSource {
  #room: Room;
  #channel: PresenceChannel<string | null>;
  #editors: PeerMarks<string> | null = null;
  #listeners = new Set<() => void>();

  #invalidate = (): void => {
    this.#editors = null;
    for (const listener of this.#listeners) {
      listener();
    }
  };

  constructor(
    room: Room
  ) {
    this.#room = room;
    this.#channel = new PresenceChannel<string | null>(room, {
      key: PEER_FIELD_LOCK_KEY,
      decode: decodeString
    });

    this.#channel.on("change", this.#invalidate);
    for (const event of kSelfEvents) {
      room.on(event, this.#invalidate);
    }
  }

  editors(
    path: string
  ): readonly PresencePeer[] {
    this.#editors ??= new PeerMarks(this.#marks());

    return this.#editors.peersAt(path);
  }

  claim(
    path: string
  ): void {
    this.#publish(path);
  }

  release(
    path: string
  ): void {
    if (this.#channel.published === path) {
      this.#publish(null);
    }
  }

  subscribe(
    listener: () => void
  ): () => void {
    this.#listeners.add(listener);

    return () => this.#listeners.delete(listener);
  }

  dispose(): void {
    for (const event of kSelfEvents) {
      this.#room.off(event, this.#invalidate);
    }
    this.#channel.off("change", this.#invalidate);
    this.#channel.destroy();
    this.#listeners.clear();
  }

  #publish(
    path: string | null
  ): void {
    if (this.#channel.publish(path)) {
      this.#invalidate();
    }
  }

  #marks(): PeerMark<string>[] {
    const { published, values } = this.#channel;

    return roomPeers(this.#room).flatMap((peer): PeerMark<string>[] => {
      const path = peer.self === true ? published : values.get(peer.clientId);

      return typeof path === "string" ? [[peer, path]] : [];
    });
  }
}
