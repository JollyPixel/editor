// Import Third-party Dependencies
import type * as THREE from "three";
import type {
  CameraPose,
  Systems
} from "@jolly-pixel/engine";
import { PeerFrustums } from "@jolly-pixel/editor.host";
import type { SceneRoom } from "@jolly-pixel/asset.scene/client";
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
  #selection: SelectionStore;

  #onSelect = (): void => {
    this.#selections.publishLocal();
  };

  constructor(
    options: SceneCollaborationOptions
  ) {
    const { room, selection, presence } = options;
    this.#selection = selection;

    this.#roster = new PeerRoster({
      room,
      publish: (peers) => {
        presence.peers = peers;
      }
    });
    this.#selections = new PeerMarkTracker({
      room,
      presenceKey: kSelectionKey,
      localKey: () => selection.primary,
      readKey: (value) => (typeof value === "string" ? value : null),
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
    selection.on("change", this.#onSelect);
  }

  peerPose(
    clientId: string
  ): CameraPose | undefined {
    return this.#frustums.peerPose(clientId);
  }

  dispose(): void {
    this.#selection.off("change", this.#onSelect);
    this.#selections.dispose();
    this.#roster.dispose();
  }
}
