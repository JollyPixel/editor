// Import Third-party Dependencies
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import {
  PresenceChannel,
  type PresenceChange,
  type Room
} from "@jolly-pixel/network/client";
import type {
  VoxelMapNetworkCommand,
  VoxelMapServerMessage
} from "@jolly-pixel/asset.voxel-map/client";
import { peerProfileColor } from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import { BrushFootprint } from "../model/BrushFootprint.ts";
import { BrushMesh } from "../rendering/BrushMesh.ts";
import type { PeerEditContext } from "../../templates/editing/PeerEditContext.ts";

// CONSTANTS
const kPresenceCursorKey = "brush";

export interface PeerBrushesOptions {
  room: Room<VoxelMapNetworkCommand, VoxelMapServerMessage>;
  peers: Pick<PeerEditContext, "shares" | "subscribe">;
}

export class PeerBrushes extends ActorComponent {
  #room: Room<VoxelMapNetworkCommand, VoxelMapServerMessage>;
  #peers: Pick<PeerEditContext, "shares">;
  #unsubscribePeers: () => void;
  #channel: PresenceChannel<BrushFootprint | null>;
  #meshes = new Map<string, BrushMesh>();
  #localCursor: BrushFootprint | null = null;

  #onPeerChange = (
    change: PresenceChange<BrushFootprint | null>
  ): void => {
    if (change.value === undefined) {
      this.#removeMesh(change.clientId);
    }
    else {
      this.#render(change.clientId);
    }
    this.actor.world.invalidate();
  };

  constructor(
    actor: Actor,
    options: PeerBrushesOptions
  ) {
    super({
      actor,
      typeName: "PeerBrushes"
    });

    this.#room = options.room;
    this.#peers = options.peers;
    this.#channel = new PresenceChannel(options.room, {
      key: kPresenceCursorKey,
      decode: BrushFootprint.parse,
      equals: (left, right) => left === right || left?.equals(right) === true
    });

    this.#renderAll();
    this.#channel.on("change", this.#onPeerChange);
    this.#unsubscribePeers = options.peers.subscribe("change", () => {
      this.#renderAll();
      this.actor.world.invalidate();
    });
  }

  publishLocalCursor(
    next: BrushFootprint | null
  ): void {
    if (!this.#channel.publish(next)) {
      return;
    }

    this.#localCursor = next;
    this.#renderAll();
  }

  override destroy(): void {
    this.#unsubscribePeers();
    this.#channel.off("change", this.#onPeerChange);
    this.#channel.destroy();

    for (const clientId of [...this.#meshes.keys()]) {
      this.#removeMesh(clientId);
    }

    super.destroy();
  }

  #renderAll(): void {
    for (const clientId of this.#channel.values.keys()) {
      this.#render(clientId);
    }
  }

  #render(
    clientId: string
  ): void {
    const peer = this.#room.peers.get(clientId);
    if (!peer) {
      return;
    }

    const mesh = this.#ensureMesh(
      clientId,
      peerProfileColor(clientId, peer.profile)
    );
    const peerCursor = this.#channel.values.get(clientId) ?? null;

    if (
      peerCursor === null ||
      peerCursor.overlaps(this.#localCursor) ||
      !this.#peers.shares(clientId)
    ) {
      mesh.hide();

      return;
    }

    mesh.show();
    mesh.draw(peerCursor);
  }

  #ensureMesh(
    clientId: string,
    color: string
  ): BrushMesh {
    const existing = this.#meshes.get(clientId);
    if (existing) {
      return existing;
    }

    const mesh = new BrushMesh({
      color,
      subdued: true
    });
    mesh.hide();
    this.#meshes.set(clientId, mesh);
    this.actor.addChildren(mesh);

    return mesh;
  }

  #removeMesh(
    clientId: string
  ): void {
    const mesh = this.#meshes.get(clientId);
    if (!mesh) {
      return;
    }

    this.actor.removeChildren(mesh);
    this.#meshes.delete(clientId);
  }
}
