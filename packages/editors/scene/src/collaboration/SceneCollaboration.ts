// Import Third-party Dependencies
import { PeerFrustums } from "@jolly-pixel/editor.host/viewport";
import type * as THREE from "three";
import type {
  CameraPose,
  Systems
} from "@jolly-pixel/engine";
import type { SceneRoom } from "@jolly-pixel/asset.scene/client";
import { decodeString } from "@jolly-pixel/network/client";
import {
  PeerMarkTracker,
  PeerRoster
} from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import type { PresenceStore } from "../state/PresenceStore.ts";
import type { SelectionStore } from "../state/SelectionStore.ts";

// CONSTANTS
const kSelectionKey = "actor";

export interface SceneCollaborationOptions {
  room: SceneRoom;
  world: Systems.World;
  camera: THREE.PerspectiveCamera;
  selection: SelectionStore;
  presence: PresenceStore;
}

export class SceneCollaboration {
  #roster: PeerRoster;
  #selections: PeerMarkTracker<string>;
  #frustums: PeerFrustums;

  constructor(
    options: SceneCollaborationOptions
  ) {
    const { room, selection, presence } = options;

    this.#roster = new PeerRoster({
      room,
      publish: (peers) => {
        presence.peers = peers;
      }
    });
    this.#selections = new PeerMarkTracker({
      room,
      presenceKey: kSelectionKey,
      decode: decodeString,
      local: {
        read: () => selection.primary,
        subscribe: (listener) => selection.subscribe("change", listener)
      },
      publish: (marks) => {
        presence.selections = marks;
      }
    });
    this.#frustums = options.world
      .createActor("peer-frustums")
      .addComponentAndGet(PeerFrustums, {
        room,
        camera: options.camera
      });
  }

  peerPose(
    clientId: string
  ): CameraPose | undefined {
    return this.#frustums.peerPose(clientId);
  }

  dispose(): void {
    this.#selections.dispose();
    this.#roster.dispose();
  }
}
