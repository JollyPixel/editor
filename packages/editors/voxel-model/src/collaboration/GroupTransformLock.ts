// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  peerColor,
  readUsername
} from "./identity.ts";
import type { PeerMark } from "./peerMarks.ts";
import { PRESENCE_KEYS } from "./presenceKeys.ts";
import type {
  ModelNetworkCommand,
  ModelServerMessage
} from "../network/types.ts";

export interface GroupTransformLockOptions {
  room: network.Room<ModelNetworkCommand, ModelServerMessage>;
}

export class GroupTransformLock {
  #room: network.Room<ModelNetworkCommand, ModelServerMessage>;
  #heldUuid: string | null = null;
  #locks = new Map<string, string>();
  #listeners = new Set<() => void>();

  #onSync = (): void => {
    this.#locks.clear();
    for (const [clientId, peer] of this.#room.peers) {
      const uuid = readLockUuid(peer.presence[PRESENCE_KEYS.transformLock]);
      if (uuid !== null) {
        this.#locks.set(clientId, uuid);
      }
    }
    this.#notify();
  };

  #onPeerPresence = (
    event: network.RoomPeerPresenceEvent
  ): void => {
    if (!(PRESENCE_KEYS.transformLock in event.patch)) {
      return;
    }

    const uuid = readLockUuid(event.patch[PRESENCE_KEYS.transformLock]);
    if (uuid === null) {
      this.#locks.delete(event.clientId);
    }
    else {
      this.#locks.set(event.clientId, uuid);
    }
    this.#notify();
  };

  #onPeerLeft = (
    event: network.RoomPeerEvent
  ): void => {
    if (this.#locks.delete(event.clientId)) {
      this.#notify();
    }
  };

  constructor(
    options: GroupTransformLockOptions
  ) {
    this.#room = options.room;

    this.#room.on("sync", this.#onSync);
    this.#room.on("peer-presence", this.#onPeerPresence);
    this.#room.on("peer-left", this.#onPeerLeft);
  }

  get heldUuid(): string | null {
    return this.#heldUuid;
  }

  claim(
    uuid: string
  ): void {
    this.#heldUuid = uuid;
    this.#room.updatePresence({ [PRESENCE_KEYS.transformLock]: uuid });
  }

  release(): void {
    if (this.#heldUuid === null) {
      return;
    }

    this.#heldUuid = null;
    this.#room.updatePresence({ [PRESENCE_KEYS.transformLock]: null });
  }

  lockedBy(
    uuid: string
  ): PeerMark | null {
    const candidates = [...this.#locks]
      .filter(([, lockedUuid]) => lockedUuid === uuid)
      .map(([clientId]) => clientId);

    if (this.#heldUuid === uuid) {
      candidates.push(this.#room.clientId);
    }

    if (candidates.length === 0) {
      return null;
    }

    const [winner] = candidates.sort((left, right) => left.localeCompare(right));
    if (winner === this.#room.clientId) {
      return null;
    }

    const peer = this.#room.peers.get(winner);

    return {
      clientId: winner,
      displayName: readUsername(peer?.profile),
      color: peerColor(winner, peer?.profile)
    };
  }

  onChange(
    listener: () => void
  ): () => void {
    this.#listeners.add(listener);

    return () => {
      this.#listeners.delete(listener);
    };
  }

  dispose(): void {
    this.#room.off("sync", this.#onSync);
    this.#room.off("peer-presence", this.#onPeerPresence);
    this.#room.off("peer-left", this.#onPeerLeft);

    this.release();
    this.#locks.clear();
    this.#listeners.clear();
  }

  #notify(): void {
    for (const listener of this.#listeners) {
      listener();
    }
  }
}

function readLockUuid(
  value: unknown
): string | null {
  return typeof value === "string" ? value : null;
}
