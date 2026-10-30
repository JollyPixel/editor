// Import Third-party Dependencies
import type { TerrainLiveSender } from "@jolly-pixel/asset.terrain/client";
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import {
  PresenceChannel,
  type PresenceChange,
  type Room
} from "@jolly-pixel/network/client";
import type { TerrainReader } from "@jolly-pixel/terrain.renderer";
import { peerProfileColor } from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import {
  BRUSH_RING_PRESENCE_KEY,
  decodeBrushRing,
  sameBrushRing
} from "../model/brushRingPresence.ts";
import {
  BrushRing,
  type BrushRingShape
} from "../rendering/BrushRing.ts";

export interface PeerBrushRingsOptions {
  room: Room;
  terrain: TerrainReader;
  sender: Pick<TerrainLiveSender, "interest">;
}

export class PeerBrushRings extends ActorComponent {
  #room: Room;
  #terrain: TerrainReader;
  #sender: Pick<TerrainLiveSender, "interest">;
  #brushes: PresenceChannel<BrushRingShape | null>;
  #rings = new Map<string, BrushRing>();

  #onBrushChange = (
    change: PresenceChange<BrushRingShape | null>
  ): void => {
    if (change.value === undefined) {
      this.#removeRing(change.clientId);
    }
    else {
      this.#render(change.clientId);
    }
    this.actor.world.invalidate();
  };

  constructor(
    actor: Actor,
    options: PeerBrushRingsOptions
  ) {
    super({
      actor,
      typeName: "PeerBrushRings"
    });

    this.#room = options.room;
    this.#terrain = options.terrain;
    this.#sender = options.sender;
    this.#brushes = new PresenceChannel(options.room, {
      key: BRUSH_RING_PRESENCE_KEY,
      decode: decodeBrushRing,
      equals: sameBrushRing
    });
  }

  awake(): void {
    this.#brushes.on("change", this.#onBrushChange);
    this.refresh();
  }

  publishLocalRing(
    shape: BrushRingShape | null
  ): void {
    this.#brushes.publish(shape);
  }

  refresh(): void {
    for (const clientId of this.#brushes.values.keys()) {
      this.#render(clientId);
    }
  }

  override destroy(): void {
    this.#brushes.off("change", this.#onBrushChange);
    this.#brushes.destroy();
    for (const clientId of [...this.#rings.keys()]) {
      this.#removeRing(clientId);
    }

    super.destroy();
  }

  #render(
    clientId: string
  ): void {
    const peer = this.#room.peers.get(clientId);
    const shape = this.#brushes.values.get(clientId) ?? null;
    const { interest } = this.#sender;
    if (
      peer === undefined ||
      shape === null ||
      interest === null ||
      !interest.containsSample(shape.x, shape.z)
    ) {
      this.#hideRing(clientId);

      return;
    }

    this.#ensureRing(clientId, peerProfileColor(clientId, peer.profile))
      .draw(this.#terrain, shape);
  }

  #ensureRing(
    clientId: string,
    color: string
  ): BrushRing {
    const existing = this.#rings.get(clientId);
    if (existing !== undefined) {
      return existing;
    }

    const ring = new BrushRing({
      outer: color,
      inner: color
    });
    this.#rings.set(clientId, ring);
    this.actor.object3D.add(ring);

    return ring;
  }

  #hideRing(
    clientId: string
  ): void {
    const ring = this.#rings.get(clientId);
    if (ring !== undefined) {
      ring.visible = false;
    }
  }

  #removeRing(
    clientId: string
  ): void {
    const ring = this.#rings.get(clientId);
    if (ring === undefined) {
      return;
    }

    this.actor.object3D.remove(ring);
    ring.dispose();
    this.#rings.delete(clientId);
  }
}
