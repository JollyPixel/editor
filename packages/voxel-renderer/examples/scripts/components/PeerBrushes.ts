// Import Third-party Dependencies
import * as THREE from "three";
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import type * as network from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type {
  VoxelNetworkCommand,
  VoxelServerMessage
} from "../../../src/network/types.ts";
import type { VoxelCoord } from "../../../src/world/types.ts";
import {
  createHighlightBox,
  moveHighlight,
  LOCAL_BRUSH_COLOR
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
  /** Local username, shown in the legend as "(you)". */
  username: string;
  /** Element the peer legend is rendered into. */
  legend: HTMLElement;
}

/**
 * Broadcasts the local brush cell over the room's presence channel and mirrors
 * every peer's cell as a colored wireframe cube.
 */
export class PeerBrushes extends ActorComponent {
  #room: network.Room<VoxelNetworkCommand, VoxelServerMessage>;
  #username: string;
  #legend: HTMLElement;
  #boxes = new Map<string, THREE.Group>();
  #lastSent: VoxelCoord | null | undefined;
  /** Identity of the rendered legend, so the DOM is only rebuilt on change. */
  #legendKey = "";

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
    this.#legend = options.legend;
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
        this.#boxFor(clientId),
        readBrushCoord(peer.presence[kPresenceBrushKey])
      );
    }

    for (const clientId of this.#boxes.keys()) {
      if (!seen.has(clientId)) {
        this.#removeBox(clientId);
      }
    }

    this.#renderLegend(seen);
  }

  override destroy(): void {
    for (const clientId of [...this.#boxes.keys()]) {
      this.#removeBox(clientId);
    }
    this.#legend.replaceChildren();

    super.destroy();
  }

  #boxFor(
    clientId: string
  ): THREE.Group {
    const existing = this.#boxes.get(clientId);
    if (existing) {
      return existing;
    }

    const box = createHighlightBox(peerColor(clientId));
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

  #renderLegend(
    peerIds: ReadonlySet<string>
  ): void {
    // `room.clientId` is the Client's own UUID, while peers are keyed by the
    // one the transport mints per connection — the two never match, so a local
    // color derived from it would disagree with the box peers actually see.
    // The local brush has its own reserved color instead.
    const entries = [
      {
        color: LOCAL_BRUSH_COLOR,
        label: `${this.#username} (you)`
      },
      ...[...peerIds].sort().map((clientId) => {
        return {
          color: peerColor(clientId),
          label: readUsername(this.#room.peers.get(clientId)?.identity ?? {})
        };
      })
    ];

    const key = entries.map(({ color, label }) => `${color}${label}`).join("|");
    if (key === this.#legendKey) {
      return;
    }
    this.#legendKey = key;

    this.#legend.replaceChildren(...entries.map(({ color, label }) => {
      const row = document.createElement("div");
      row.className = "peer";

      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.background = color;

      row.append(swatch, document.createTextNode(label));

      return row;
    }));
  }
}
