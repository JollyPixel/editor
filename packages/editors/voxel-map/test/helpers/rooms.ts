// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type {
  Peer,
  PeerMetadata,
  Right,
  RoomEventMap,
  RoomRights
} from "@jolly-pixel/network/client";
import type {
  VoxelMapRoom,
  VoxelMapServerMessage
} from "@jolly-pixel/asset.voxel-map/client";

export class FakeRoom
  extends Emitter<RoomEventMap<VoxelMapServerMessage>>
  implements VoxelMapRoom {
  readonly id = "voxel-map:test";
  readonly clientId = "local";
  readonly peers = new Map<string, Peer>();
  readonly profile = null;
  readonly role = "editor";
  readonly rights: RoomRights = {};
  readonly access: Right = "write";
  readonly presence: PeerMetadata[] = [];

  can(): Right {
    return this.access;
  }

  join(): void {
    return void 0;
  }

  send(): void {
    return void 0;
  }

  updatePresence(
    patch: PeerMetadata
  ): void {
    this.presence.push(patch);
  }

  resync(): void {
    return void 0;
  }

  resumeWith(): void {
    return void 0;
  }

  leave(): void {
    return void 0;
  }

  joinPeer(
    clientId: string
  ): void {
    this.peers.set(clientId, {
      clientId,
      role: "editor",
      profile: {
        username: clientId,
        peerId: clientId
      },
      presence: {}
    });
    this.emit("peer-joined", { clientId });
  }

  leavePeer(
    clientId: string
  ): void {
    this.peers.delete(clientId);
    this.emit("peer-left", { clientId });
  }

  receivePresence(
    clientId: string,
    patch: PeerMetadata
  ): void {
    const peer = this.peers.get(clientId);
    if (peer !== undefined) {
      this.peers.set(clientId, {
        ...peer,
        presence: {
          ...peer.presence,
          ...patch
        }
      });
    }
    this.emit("peer-presence", {
      clientId,
      patch
    });
  }
}
