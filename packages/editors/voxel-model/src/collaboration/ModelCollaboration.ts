// Import Third-party Dependencies
import type * as THREE from "three";
import type { Systems } from "@jolly-pixel/engine";
import { PeerFrustums } from "@jolly-pixel/editor.host";
import type { PeerIdentity } from "@jolly-pixel/ui";
import { PeerRoster } from "@jolly-pixel/ui/network";
import type {
  VoxelModelRoom
} from "@jolly-pixel/asset.voxel-model/network/client.ts";

// Import Internal Dependencies
import type { ModelBlocks } from "../scene/index.ts";
import type { PresenceStore } from "../state/index.ts";
import { BlockHoverPresence } from "./BlockHoverPresence.ts";
import { BlockSelectionPresence } from "./BlockSelectionPresence.ts";
import { TransformLiveSync } from "./TransformLiveSync.ts";
import { TransformLock } from "./TransformLock.ts";

export interface ModelCollaborationOptions {
  room: VoxelModelRoom;
  identity: PeerIdentity;
  blocks: ModelBlocks;
  presence: PresenceStore;
  world: Systems.World;
  camera: THREE.PerspectiveCamera;
}

export class ModelCollaboration {
  readonly lock: TransformLock;
  readonly live: TransformLiveSync;
  readonly frustums: PeerFrustums;

  #roster: PeerRoster;
  #selections: BlockSelectionPresence;
  #hovers: BlockHoverPresence;

  constructor(
    options: ModelCollaborationOptions
  ) {
    const {
      room,
      blocks,
      presence
    } = options;

    this.#roster = new PeerRoster({
      room,
      identity: options.identity,
      publish: (peers) => {
        presence.peers = peers;
      }
    });
    this.#selections = new BlockSelectionPresence({
      room,
      blocks,
      presence
    });
    this.#hovers = new BlockHoverPresence({
      room,
      blocks,
      presence
    });
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
