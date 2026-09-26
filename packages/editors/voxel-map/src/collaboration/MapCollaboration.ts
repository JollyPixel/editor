// Import Third-party Dependencies
import type * as THREE from "three";
import type { Systems } from "@jolly-pixel/engine";
import { PeerFrustums } from "@jolly-pixel/editor.host";
import type { PeerIdentity } from "@jolly-pixel/ui";
import { PeerRoster } from "@jolly-pixel/ui/network";
import type {
  VoxelMapRoom
} from "@jolly-pixel/asset.voxel-map/client";

// Import Internal Dependencies
import type { EditorState } from "../state/index.ts";
import { BlockSelectionPresence } from "../features/blocks/collaboration/BlockSelectionPresence.ts";
import { LayerSelectionPresence } from "../features/layers/collaboration/LayerSelectionPresence.ts";
import {
  PeerBrushes,
  type LocalBrush
} from "../features/painting/index.ts";

export interface MapCollaborationOptions {
  room: VoxelMapRoom;
  identity: PeerIdentity;
  state: EditorState;
  world: Systems.World;
  camera: THREE.PerspectiveCamera;
  localBrush: LocalBrush;
}

export class MapCollaboration {
  readonly frustums: PeerFrustums;

  #roster: PeerRoster;
  #blockSelections: BlockSelectionPresence;
  #layerSelections: LayerSelectionPresence;

  constructor(
    options: MapCollaborationOptions
  ) {
    const { room, state, world, localBrush } = options;

    this.#roster = new PeerRoster({
      room,
      identity: options.identity,
      publish: (peers) => {
        state.presence.peers = peers;
      },
      log: state.log
    });
    this.#blockSelections = new BlockSelectionPresence({
      room,
      brush: state.brush,
      presence: state.presence
    });
    this.#layerSelections = new LayerSelectionPresence({
      room,
      selection: state.selection,
      presence: state.presence
    });

    const peerBrushes = world
      .createActor("peer-brushes")
      .addComponentAndGet(PeerBrushes, {
        room,
        brush: state.brush
      });
    localBrush.onCursorChange = (cursor) => {
      peerBrushes.publishLocalCursor(cursor);
    };

    this.frustums = world
      .createActor("peer-frustums")
      .addComponentAndGet(PeerFrustums, {
        room,
        camera: options.camera
      });
  }

  dispose(): void {
    this.#roster.dispose();
    this.#blockSelections.dispose();
    this.#layerSelections.dispose();
  }
}
