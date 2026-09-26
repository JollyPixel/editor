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
  VoxelNetworkCommand,
  VoxelServerMessage
} from "@jolly-pixel/asset.voxel-map/client";
import { peerProfileColor } from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import type { BrushStore } from "../../../state/index.ts";
import * as cursor from "../model/brushCursor.ts";
import type { BrushCursor } from "../model/brushCursor.ts";
import { overlaps } from "../model/brushFootprint.ts";
import { BrushMesh } from "../rendering/BrushMesh.ts";
import type { BrushStyle } from "../model/BrushStyle.ts";

// CONSTANTS
const kPresenceCursorKey = "brush";

export interface PeerBrushesOptions {
  room: Room<VoxelNetworkCommand, VoxelServerMessage>;
  brush: BrushStore;
}

export class PeerBrushes extends ActorComponent {
  #room: Room<VoxelNetworkCommand, VoxelServerMessage>;
  #channel: PresenceChannel<BrushCursor | null>;
  #brush: BrushStore;
  #meshes = new Map<string, BrushMesh>();
  #localCursor: BrushCursor | null = null;
  #unsubscribeStyle: () => void;

  #onStyleChange = (style: BrushStyle): void => {
    for (const mesh of this.#meshes.values()) {
      mesh.style = style;
    }
  };

  #onPeerChange = (
    change: PresenceChange<BrushCursor | null>
  ): void => {
    if (change.value === undefined) {
      this.#removeMesh(change.clientId);
    }
    else {
      this.#render(change.clientId);
    }
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
    this.#brush = options.brush;
    this.#channel = new PresenceChannel(options.room, {
      key: kPresenceCursorKey,
      decode: cursor.read,
      equals: cursor.equals
    });
    this.#unsubscribeStyle = this.#brush.subscribe(
      "styleChange",
      this.#onStyleChange
    );

    for (const clientId of this.#channel.values.keys()) {
      this.#render(clientId);
    }
    this.#channel.on("change", this.#onPeerChange);
  }

  publishLocalCursor(
    next: BrushCursor | null
  ): void {
    if (!this.#channel.publish(next)) {
      return;
    }

    this.#localCursor = next;
    for (const clientId of this.#channel.values.keys()) {
      this.#render(clientId);
    }
  }

  override destroy(): void {
    this.#unsubscribeStyle();
    this.#channel.off("change", this.#onPeerChange);
    this.#channel.destroy();

    for (const clientId of [...this.#meshes.keys()]) {
      this.#removeMesh(clientId);
    }

    super.destroy();
  }

  #render(
    clientId: string
  ): void {
    const peer = this.#room.peers.get(clientId);
    if (!peer) {
      return;
    }

    const mesh = this.#meshFor(
      clientId,
      peerProfileColor(clientId, peer.profile)
    );
    const peerCursor = this.#channel.values.get(clientId) ?? null;

    if (
      peerCursor === null ||
      overlaps(peerCursor, this.#localCursor)
    ) {
      mesh.hide();

      return;
    }

    mesh.show();
    mesh.draw(peerCursor);
  }

  #meshFor(
    clientId: string,
    color: string
  ): BrushMesh {
    const existing = this.#meshes.get(clientId);
    if (existing) {
      return existing;
    }

    const mesh = new BrushMesh({
      color,
      style: this.#brush.style,
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
