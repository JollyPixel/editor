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
const kPeerEvents = [
  "sync",
  "peer-joined",
  "peer-left",
  "peer-presence"
] as const;

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

interface ValidStamp {
  clientId: string;
  displayName: string;
  color: string;
  editing?: unknown;
}

interface ResolvedPeers {
  map: Map<string, CollaboratorPresence>;
  local: CollaboratorPresence;
  identityKeys: string[];
  editing: string | null;
  remote: CollaboratorPresence[];
}

export class RoomPresenceSource implements PresenceSource {
  readonly clientId: string;

  #room: Room;
  #identity: LocalPeerIdentity;
  #editing: string | null = null;
  #listeners = new Set<() => void>();
  #detach: (() => void)[] = [];
  #resolved: ResolvedPeers | null = null;

  constructor(
    room: Room,
    identity: LocalPeerIdentity
  ) {
    this.#room = room;
    this.#identity = identity;
    this.clientId = identity.clientId;

    const emit = () => this.#emit();
    for (const event of kPeerEvents) {
      room.on(event, emit);
      this.#detach.push(() => room.off(event, emit));
    }

    this.#publish();
  }

  get peers(): ReadonlyMap<string, CollaboratorPresence> {
    const previous = this.#resolved;
    if (previous !== null && this.#isCurrent(previous)) {
      return previous.map;
    }

    const local = previous !== null && this.#matchesLocal(previous) ?
      previous.local :
      this.#localPresence();
    const map = new Map<string, CollaboratorPresence>([
      [this.clientId, local]
    ]);
    for (const peer of this.#room.peers.values()) {
      const stamp = validStamp(peer.presence);
      if (stamp !== null && stamp.clientId !== this.clientId) {
        const known = previous?.map.get(stamp.clientId);
        map.set(
          stamp.clientId,
          known !== undefined && matchesStamp(known, stamp) ?
            known :
            toPresence(stamp)
        );
      }
    }

    const remote = [...map.values()];
    remote.shift();
    this.#resolved = {
      map,
      local,
      identityKeys: Object.keys(this.#identity),
      editing: this.#editing,
      remote
    };

    return map;
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

  #isCurrent(
    resolved: ResolvedPeers
  ): boolean {
    if (
      resolved.map.size !== resolved.remote.length + 1 ||
      !this.#matchesLocal(resolved)
    ) {
      return false;
    }

    let index = 0;
    for (const peer of this.#room.peers.values()) {
      const stamp = validStamp(peer.presence);
      if (stamp === null || stamp.clientId === this.clientId) {
        continue;
      }

      const known = resolved.remote[index];
      if (known === undefined || !matchesStamp(known, stamp)) {
        return false;
      }
      index++;
    }

    return index === resolved.remote.length;
  }

  #matchesLocal(
    resolved: ResolvedPeers
  ): boolean {
    if (resolved.editing !== this.#editing) {
      return false;
    }

    const identity = this.#identity as unknown as Record<string, unknown>;
    const local = resolved.local as unknown as Record<string, unknown>;

    let count = 0;
    for (const key in identity) {
      if (!Object.hasOwn(identity, key)) {
        continue;
      }
      if (key === "editing" || !Object.is(local[key], identity[key])) {
        return false;
      }
      count++;
    }

    return count === resolved.identityKeys.length;
  }

  #localPresence(): CollaboratorPresence {
    return {
      ...this.#identity,
      ...this.#editing === null ? {} : { editing: this.#editing }
    };
  }

  #publish(): void {
    this.#room.updatePresence({
      [kPresenceKey]: {
        ...this.#identity,
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

function validStamp(
  presence: Record<string, unknown>
): ValidStamp | null {
  const stamp = presence[kPresenceKey] as StampedPresence | undefined;
  if (
    typeof stamp?.clientId !== "string" ||
    typeof stamp.displayName !== "string" ||
    typeof stamp.color !== "string"
  ) {
    return null;
  }

  return stamp as ValidStamp;
}

function toPresence(
  stamp: ValidStamp
): CollaboratorPresence {
  return {
    clientId: stamp.clientId,
    displayName: stamp.displayName,
    color: stamp.color,
    ...typeof stamp.editing === "string"
      ? { editing: stamp.editing }
      : {}
  };
}

function matchesStamp(
  known: CollaboratorPresence,
  stamp: ValidStamp
): boolean {
  const editing = typeof stamp.editing === "string" ?
    stamp.editing :
    undefined;

  return known.clientId === stamp.clientId &&
    known.displayName === stamp.displayName &&
    known.color === stamp.color &&
    known.editing === editing;
}
