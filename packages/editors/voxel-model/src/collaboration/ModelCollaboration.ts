// Import Third-party Dependencies
import type * as THREE from "three";
import type { Systems } from "@jolly-pixel/engine";
import { PeerFrustums } from "@jolly-pixel/editor.host";
import type { PeerIdentity } from "@jolly-pixel/ui";
import { PeerRoster } from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import type { ModelDocument } from "../model/index.ts";
import type { ModelBlocks } from "../scene/index.ts";
import type { PresenceStore } from "../state/index.ts";
import { BlockSelectionPresence } from "./BlockSelectionPresence.ts";
import { ModelSyncClient } from "./ModelSyncClient.ts";
import { PeerSelectionHighlight } from "./PeerSelectionHighlight.ts";
import { TransformLiveSync } from "./TransformLiveSync.ts";
import { TransformLock } from "./TransformLock.ts";
import type { VoxelModelRoom } from "./types.ts";

export interface ModelCollaborationOptions {
  room: VoxelModelRoom;
  identity: PeerIdentity;
  document: ModelDocument;
  blocks: ModelBlocks;
  presence: PresenceStore;
  world: Systems.World;
  camera: THREE.PerspectiveCamera;
}

export class ModelCollaboration {
  readonly sync: ModelSyncClient;
  readonly lock: TransformLock;
  readonly live: TransformLiveSync;
  readonly frustums: PeerFrustums;

  #roster: PeerRoster;
  #selections: BlockSelectionPresence;
  #highlight: PeerSelectionHighlight;

  constructor(
    options: ModelCollaborationOptions
  ) {
    const {
      room,
      document,
      blocks,
      presence
    } = options;

    this.sync = new ModelSyncClient({ room, document });
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
    this.#highlight = new PeerSelectionHighlight({
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
    this.sync.destroy();
    this.#roster.dispose();
    this.#selections.dispose();
    this.#highlight.dispose();
    this.live.dispose();
    this.lock.dispose();
  }
}
