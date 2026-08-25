// Import Third-party Dependencies
import type { Room } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type {
  LockState,
  PresenceSource
} from "../peer/PresenceSource.ts";
import type { CollaboratorPresence } from "../peer/types.ts";

// CONSTANTS
const kPresenceKey = "jolly";

/**
 * Host identity stamped into presence; `room.clientId` is not shared.
 */
export interface LocalPeerIdentity {
  clientId: string;
  displayName: string;
  color: string;
}

interface StampedPresence {
  clientId?: unknown;
  displayName?: unknown;
  color?: unknown;
  editing?: unknown;
}

/**
 * Adapts a client `Room` without pulling server dependencies into the browser.
 */
export class RoomPresenceSource implements PresenceSource {
  readonly clientId: string;

  #room: Room;
  #identity: LocalPeerIdentity;
  #editing: string | null = null;
  #listeners = new Set<() => void>();
  #detach: (() => void)[] = [];

  constructor(
    room: Room,
    identity: LocalPeerIdentity
  ) {
    this.#room = room;
    this.#identity = identity;
    this.clientId = identity.clientId;

    const emit = () => this.#emit();
    for (const event of ["peer-left", "peer-presence"] as const) {
      room.on(event, emit);
      this.#detach.push(() => room.off(event, emit));
    }

    /**
     * Republish after sync or peer-joined because early patches can be dropped.
     */
    const republish = () => {
      this.#publish();
      this.#emit();
    };
    for (const event of ["sync", "peer-joined"] as const) {
      room.on(event, republish);
      this.#detach.push(() => room.off(event, republish));
    }

    this.#publish();
  }

  /**
   * Includes a synthesized local peer because `room.peers` tracks remotes.
   */
  get peers(): ReadonlyMap<string, CollaboratorPresence> {
    const peers = new Map<string, CollaboratorPresence>([
      [this.clientId, {
        ...this.#identity,
        ...this.#editing === null ? {} : { editing: this.#editing }
      }]
    ]);

    for (const peer of this.#room.peers.values()) {
      const presence = readStamp(peer.presence);
      if (presence !== null && presence.clientId !== this.clientId) {
        peers.set(presence.clientId, presence);
      }
    }

    return peers;
  }

  claim(
    path: string
  ): LockState {
    const contended = [...this.peers.values()].some(
      (peer) => peer.clientId !== this.clientId && peer.editing === path
    );
    this.#editing = path;
    this.#publish();
    this.#emit();

    /**
     * Contended claims remain advisory and are still published.
     */
    return contended ? "contended" : "held";
  }

  release(
    path: string
  ): void {
    if (this.#editing !== path) {
      return;
    }

    this.#editing = null;
    this.#publish();
    this.#emit();
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
    for (const detach of this.#detach) {
      detach();
    }
    this.#detach = [];
    this.#listeners.clear();
  }

  #publish(): void {
    this.#room.updatePresence({
      [kPresenceKey]: {
        ...this.#identity,
        /**
         * Publish null because JSON drops undefined, leaving stale presence.
         */
        editing: this.#editing
      }
    });
  }

  #emit(): void {
    for (const listener of this.#listeners) {
      listener();
    }
  }
}

function readStamp(
  presence: Record<string, unknown>
): CollaboratorPresence | null {
  const stamp = presence[kPresenceKey] as StampedPresence | undefined;
  if (
    typeof stamp?.clientId !== "string" ||
    typeof stamp.displayName !== "string" ||
    typeof stamp.color !== "string"
  ) {
    return null;
  }

  return {
    clientId: stamp.clientId,
    displayName: stamp.displayName,
    color: stamp.color,
    // Omit non-string editing values from the public optional field.
    ...typeof stamp.editing === "string" ? { editing: stamp.editing } : {}
  };
}
