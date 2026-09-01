// Import Third-party Dependencies
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import type * as network from "@jolly-pixel/network";
import type {
  VoxelNetworkCommand,
  VoxelServerMessage
} from "@jolly-pixel/voxel.renderer/network/client.ts";

// Import Internal Dependencies
import { peerColor } from "../../network/identity.ts";
import * as cursor from "./cursor.ts";
import type { BrushCursor } from "./cursor.ts";
import { BrushMesh } from "./BrushMesh.ts";

// CONSTANTS
const kPresenceCursorKey = "brush";

export interface PeerBrushesOptions {
  room: network.Room<VoxelNetworkCommand, VoxelServerMessage>;
}

export class PeerBrushes extends ActorComponent {
  #room: network.Room<VoxelNetworkCommand, VoxelServerMessage>;
  #meshes = new Map<string, BrushMesh>();
  #lastSent: BrushCursor | null | undefined;

  #onSync = (): void => {
    this.#resync();
  };

  #onPeerLeft = (event: network.RoomPeerEvent): void => {
    this.#removeMesh(event.clientId);
  };

  #onPeerPresence = (event: network.RoomPeerPresenceEvent): void => {
    if (!(kPresenceCursorKey in event.patch)) {
      return;
    }

    this.#draw(
      event.clientId,
      cursor.read(event.patch[kPresenceCursorKey])
    );
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
    this.#room.on("sync", this.#onSync);
    this.#room.on("peer-left", this.#onPeerLeft);
    this.#room.on("peer-presence", this.#onPeerPresence);

    this.#resync();
  }

  publishLocalCursor(
    next: BrushCursor | null
  ): void {
    if (
      this.#lastSent !== undefined &&
      cursor.equals(next, this.#lastSent)
    ) {
      return;
    }

    this.#lastSent = next;
    this.#room.updatePresence({
      [kPresenceCursorKey]: next
    });
  }

  override destroy(): void {
    this.#room.off("sync", this.#onSync);
    this.#room.off("peer-left", this.#onPeerLeft);
    this.#room.off("peer-presence", this.#onPeerPresence);

    for (const clientId of [...this.#meshes.keys()]) {
      this.#removeMesh(clientId);
    }

    super.destroy();
  }

  #resync(): void {
    for (const [clientId, peer] of this.#room.peers) {
      this.#draw(
        clientId,
        cursor.read(peer.presence[kPresenceCursorKey])
      );
    }

    for (const clientId of [...this.#meshes.keys()]) {
      if (!this.#room.peers.has(clientId)) {
        this.#removeMesh(clientId);
      }
    }
  }

  #draw(
    clientId: string,
    peerCursor: BrushCursor | null
  ): void {
    const peer = this.#room.peers.get(clientId);
    if (!peer) {
      return;
    }

    const mesh = this.#meshFor(
      clientId,
      peerColor(clientId, peer.identity)
    );

    if (peerCursor === null) {
      mesh.hide();

      return;
    }

    mesh.show();
    mesh.drawCells(cursor.cellsOf(peerCursor));
  }

  #meshFor(
    clientId: string,
    color: string
  ): BrushMesh {
    const existing = this.#meshes.get(clientId);
    if (existing) {
      return existing;
    }

    const mesh = new BrushMesh({ color });
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
