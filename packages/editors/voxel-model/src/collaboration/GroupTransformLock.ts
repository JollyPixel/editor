// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import {
  peerProfileColor,
  readUsername
} from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import type { PeerMark } from "./peerMarks.ts";
import { PRESENCE_KEYS } from "./presenceKeys.ts";
import type { VoxelModelRoom } from "../network/types.ts";
import { EditorStore } from "../app/state/index.ts";

export interface GroupTransformLockOptions {
  room: VoxelModelRoom;
}

export type GroupTransformLockEvents = {
  change: () => void;
};

export class GroupTransformLock extends EditorStore<GroupTransformLockEvents> {
  #room: VoxelModelRoom;
  #heldUuid: string | null = null;
  #locks = new Map<string, string>();

  #onSync = (): void => {
    this.#locks.clear();
    for (const [clientId, peer] of this.#room.peers) {
      const uuid = readLockUuid(peer.presence[PRESENCE_KEYS.transformLock]);
      if (uuid !== null) {
        this.#locks.set(clientId, uuid);
      }
    }
    this.emit("change");
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
    this.emit("change");
  };

  #onPeerLeft = (
    event: network.RoomPeerEvent
  ): void => {
    if (this.#locks.delete(event.clientId)) {
      this.emit("change");
    }
  };

  constructor(
    options: GroupTransformLockOptions
  ) {
    super();
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
      color: peerProfileColor(winner, peer?.profile)
    };
  }

  dispose(): void {
    this.#room.off("sync", this.#onSync);
    this.#room.off("peer-presence", this.#onPeerPresence);
    this.#room.off("peer-left", this.#onPeerLeft);

    this.release();
    this.#locks.clear();
    this.removeAllListeners();
  }
}

function readLockUuid(
  value: unknown
): string | null {
  return typeof value === "string" ? value : null;
}
