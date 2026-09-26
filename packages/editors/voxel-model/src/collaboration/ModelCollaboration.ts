// Import Third-party Dependencies
import type * as THREE from "three";
import type { Systems } from "@jolly-pixel/engine";
import { PeerFrustums } from "@jolly-pixel/editor.host";
import type { PeerIdentity } from "@jolly-pixel/ui";
import { PeerRoster } from "@jolly-pixel/ui/network";
import type {
  VoxelModelRoom
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import type { ModelBlocks } from "../scene/index.ts";
import type {
  BlockSelectionStore,
  PresenceStore
} from "../state/index.ts";
import { BlockMarkPresence } from "../features/selection/collaboration/BlockMarkPresence.ts";
import { TransformLiveSync } from "../features/transform/collaboration/TransformLiveSync.ts";
import { TransformLock } from "../features/transform/collaboration/TransformLock.ts";

export interface ModelCollaborationOptions {
  room: VoxelModelRoom;
  identity: PeerIdentity;
  blocks: ModelBlocks;
  selection: BlockSelectionStore;
  presence: PresenceStore;
  world: Systems.World;
  camera: THREE.PerspectiveCamera;
}

export class ModelCollaboration {
  readonly lock: TransformLock;
  readonly live: TransformLiveSync;
  readonly frustums: PeerFrustums;

  #roster: PeerRoster;
  #selections: BlockMarkPresence;
  #hovers: BlockMarkPresence;

  constructor(
    options: ModelCollaborationOptions
  ) {
    const {
      room,
      blocks,
      selection,
      presence
    } = options;

    this.#roster = new PeerRoster({
      room,
      identity: options.identity,
      publish: (peers) => {
        presence.peers = peers;
      }
    });
    this.#selections = new BlockMarkPresence({ room, selection, presence, mark: "select" });
    this.#hovers = new BlockMarkPresence({ room, selection, presence, mark: "hover" });
    this.frustums = options.world
      .createActor("peer-frustums")
      .addComponentAndGet(PeerFrustums, {
        room,
        camera: options.camera
      });
    this.live = new TransformLiveSync({
      room,
      blocks
    });
    this.lock = new TransformLock({ room });
  }

  dispose(): void {
    this.#roster.dispose();
    this.#selections.dispose();
    this.#hovers.dispose();
    this.live.dispose();
    this.lock.dispose();
  }
}
