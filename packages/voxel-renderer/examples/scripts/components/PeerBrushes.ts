// Import Third-party Dependencies
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import type * as network from "@jolly-pixel/network/client";
import type {
  Presence,
  PresencePeer
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type {
  VoxelNetworkCommand,
  VoxelServerMessage
} from "../../../src/network/types.ts";
import type { VoxelCoord } from "../../../src/world/types.ts";
import {
  type HighlightBox,
  createHighlightBox,
  moveHighlight
} from "../utils/brushHighlight.ts";
import {
  coordEqual,
  peerColor,
  readBrushCoord,
  readUsername
} from "../utils/presence.ts";

// CONSTANTS
const kPresenceBrushKey = "brush";

export interface PeerBrushesOptions {
  room: network.Room<VoxelNetworkCommand, VoxelServerMessage>;
  /** Local username, shown in Presence as "(you)". */
  username: string;
  /** Presence facade that renders the peer snapshot. */
  presence: Presence;
}

/**
 * Broadcasts the local brush cell over the room's presence channel and mirrors
 * every peer's cell as a colored wireframe cube.
 */
export class PeerBrushes extends ActorComponent {
  #room: network.Room<VoxelNetworkCommand, VoxelServerMessage>;
  #username: string;
  #presence: Presence;
  #boxes = new Map<string, HighlightBox>();
  #lastSent: VoxelCoord | null | undefined;
  /** Identity of the rendered snapshot, so Presence only updates on change. */
  #presenceKey = "";

  constructor(
    actor: Actor,
    options: PeerBrushesOptions
  ) {
    super({
      actor,
      typeName: "PeerBrushes"
    });

    this.#room = options.room;
    this.#username = options.username;
    this.#presence = options.presence;
  }

  /**
   * Publishes the local brush cell. Wired to `FlatWorldBrush.onBrushMoved`,
   * which already fires only on change; the guard covers a re-report of the
   * same cell after a reconnect.
   */
  report(
    position: VoxelCoord | null
  ): void {
    if (
      this.#lastSent !== undefined &&
      coordEqual(position, this.#lastSent)
    ) {
      return;
    }

    this.#lastSent = position;
    this.#room.updatePresence({
      [kPresenceBrushKey]: position
    });
  }

  update(): void {
    const seen = new Set<string>();

    // `room.peers` only ever holds remote peers: the server sends its sync
    // snapshot before adding the joiner to the member list.
    for (const [clientId, peer] of this.#room.peers) {
      seen.add(clientId);
      moveHighlight(
        this.#boxFor(clientId, readUsername(peer.identity)),
        readBrushCoord(peer.presence[kPresenceBrushKey])
      );
    }

    for (const clientId of this.#boxes.keys()) {
      if (!seen.has(clientId)) {
        this.#removeBox(clientId);
      }
    }

    this.#renderPresence(seen);
  }

  override destroy(): void {
    for (const clientId of [...this.#boxes.keys()]) {
      this.#removeBox(clientId);
    }
    this.#presence.update([]);

    super.destroy();
  }

  #boxFor(
    clientId: string,
    username: string
  ): HighlightBox {
    const existing = this.#boxes.get(clientId);
    if (existing) {
      return existing;
    }

    const box = createHighlightBox(peerColor(username));
    this.#boxes.set(clientId, box);
    this.actor.addChildren(box);

    return box;
  }

  #removeBox(
    clientId: string
  ): void {
    const box = this.#boxes.get(clientId);
    if (!box) {
      return;
    }

    this.actor.removeChildren(box);
    this.#boxes.delete(clientId);
  }

  #renderPresence(
    peerIds: ReadonlySet<string>
  ): void {
    const peers: PresencePeer[] = [
      {
        id: "local",
        color: peerColor(this.#username),
        username: this.#username,
        self: true
      },
      ...[...peerIds].sort().map((clientId) => {
        const username = readUsername(this.#room.peers.get(clientId)?.identity ?? {});

        return {
          id: clientId,
          color: peerColor(username),
          username
        };
      })
    ];

    const key = peers.map(
      (peer) => `${peer.id}:${peer.username}:${peer.color}`
    ).join("|");
    if (key === this.#presenceKey) {
      return;
    }
    this.#presenceKey = key;
    this.#presence.update(peers);
  }
}
