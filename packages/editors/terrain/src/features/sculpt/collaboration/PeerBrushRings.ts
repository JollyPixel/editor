// Import Third-party Dependencies
import {
  TERRAIN_INTEREST_KEY,
  TerrainInterest
} from "@jolly-pixel/asset.terrain/client";
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
import * as THREE from "three";

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
  camera: () => THREE.Camera | null;
  interestChanged?: (interest: TerrainInterest) => void;
}

export class PeerBrushRings extends ActorComponent {
  #room: Room;
  #terrain: TerrainReader;
  #camera: () => THREE.Camera | null;
  #interestChanged: (interest: TerrainInterest) => void;
  #interests: PresenceChannel<TerrainInterest>;
  #brushes: PresenceChannel<BrushRingShape | null>;
  #rings = new Map<string, BrushRing>();
  #cameraPosition = new THREE.Vector3();

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
    this.#camera = options.camera;
    this.#interestChanged = options.interestChanged ?? (() => undefined);
    this.#interests = new PresenceChannel(options.room, {
      key: TERRAIN_INTEREST_KEY,
      decode: TerrainInterest.parse,
      equals: (left, right) => left.equals(right)
    });
    this.#brushes = new PresenceChannel(options.room, {
      key: BRUSH_RING_PRESENCE_KEY,
      decode: decodeBrushRing,
      equals: sameBrushRing
    });
  }

  awake(): void {
    this.#brushes.on("change", this.#onBrushChange);
    this.#publishInterest();
    this.refresh();
  }

  update(): void {
    if (this.#publishInterest()) {
      this.refresh();
      this.actor.world.invalidate();
    }
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
    this.#interests.destroy();
    for (const clientId of [...this.#rings.keys()]) {
      this.#removeRing(clientId);
    }

    super.destroy();
  }

  #publishInterest(): boolean {
    const camera = this.#camera();
    if (camera === null) {
      return false;
    }

    camera.getWorldPosition(this.#cameraPosition);
    const interest = TerrainInterest.around(this.#cameraPosition.x, this.#cameraPosition.z);
    if (!this.#interests.publish(interest)) {
      return false;
    }
    this.#interestChanged(interest);

    return true;
  }

  #render(
    clientId: string
  ): void {
    const peer = this.#room.peers.get(clientId);
    const shape = this.#brushes.values.get(clientId) ?? null;
    const interest = this.#interests.published;
    if (
      peer === undefined ||
      shape === null ||
      interest === undefined ||
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
