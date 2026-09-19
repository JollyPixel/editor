// Import Third-party Dependencies
import { PresenceChannel } from "@jolly-pixel/network/client";
import { EditorStore } from "@jolly-pixel/editor.host";
import type { PresencePeer } from "@jolly-pixel/ui";
import {
  peerProfileColor,
  readUsername
} from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import { PRESENCE_KEYS } from "./presenceKeys.ts";
import type { VoxelModelRoom } from "./types.ts";

export interface TransformLockOptions {
  room: VoxelModelRoom;
}

export type TransformLockEvents = {
  change: () => void;
};

export class TransformLock extends EditorStore<TransformLockEvents> {
  #room: VoxelModelRoom;
  #channel: PresenceChannel<string | null>;
  #heldUuid: string | null = null;

  #onChange = (): void => {
    this.emit("change");
  };

  constructor(
    options: TransformLockOptions
  ) {
    super();
    this.#room = options.room;
    this.#channel = new PresenceChannel<string | null>(options.room, {
      key: PRESENCE_KEYS.transformLock,
      decode: readLockUuid
    });
    this.#channel.on("change", this.#onChange);
  }

  claim(
    uuid: string
  ): void {
    this.#heldUuid = uuid;
    this.#channel.publish(uuid);
  }

  release(): void {
    if (this.#heldUuid === null) {
      return;
    }

    this.#heldUuid = null;
    this.#channel.publish(null);
  }

  lockedBy(
    uuid: string
  ): PresencePeer | null {
    const candidates = [...this.#channel.values]
      .filter(([, lockedUuid]) => lockedUuid === uuid)
      .map(([clientId]) => clientId);

    if (this.#heldUuid === uuid) {
      candidates.push(this.#room.clientId);
    }

    const [winner] = candidates.sort((left, right) => left.localeCompare(right));
    if (winner === undefined || winner === this.#room.clientId) {
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
    this.release();
    this.#channel.off("change", this.#onChange);
    this.#channel.destroy();
    this.removeAllListeners();
  }
}

function readLockUuid(
  value: unknown
): string | undefined {
  return typeof value === "string" ? value : undefined;
}
