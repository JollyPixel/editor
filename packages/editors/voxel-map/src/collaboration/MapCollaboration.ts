// Import Third-party Dependencies
import type * as THREE from "three";
import type { Systems } from "@jolly-pixel/engine";
import { PeerFrustums } from "@jolly-pixel/editor.host";
import type { PeerIdentity } from "@jolly-pixel/ui";
import {
  PeerMarkTracker,
  PeerRoster
} from "@jolly-pixel/ui/network";
import type {
  VoxelMapRoom
} from "@jolly-pixel/asset.voxel-map/client";

// Import Internal Dependencies
import {
  layerKey,
  type EditorState
} from "../state/index.ts";
import { PeerBrushes } from "../features/painting/collaboration/PeerBrushes.ts";
import type { BrushCursor } from "../features/painting/model/brushCursor.ts";

// CONSTANTS
const kBlockPresenceKey = "block";
const kLayerPresenceKey = "layer";

export interface MapCollaborationOptions {
  room: VoxelMapRoom;
  identity: PeerIdentity;
  state: EditorState;
  world: Systems.World;
  camera: THREE.PerspectiveCamera;
}

export class MapCollaboration {
  readonly frustums: PeerFrustums;

  #peerBrushes: PeerBrushes;
  #disposables: Array<() => void> = [];

  constructor(
    options: MapCollaborationOptions
  ) {
    const { room, state, world } = options;
    const { brush, selection, presence } = state;

    const roster = new PeerRoster({
      room,
      identity: options.identity,
      publish: (peers) => {
        presence.peers = peers;
      },
      log: state.log
    });
    const blockMarks = new PeerMarkTracker({
      room,
      presenceKey: kBlockPresenceKey,
      localKey: () => brush.blockId,
      readKey: readBlockId,
      publish: (marks) => {
        presence.blockSelections = marks;
      }
    });
    const layerMarks = new PeerMarkTracker({
      room,
      presenceKey: kLayerPresenceKey,
      localKey: () => (selection.current === null ? null : layerKey(selection.current)),
      readKey: readLayerKey,
      publish: (marks) => {
        presence.layerSelections = marks;
      }
    });
    this.#disposables.push(
      brush.subscribe("blockChange", () => blockMarks.publishLocal()),
      selection.subscribe("change", () => layerMarks.publishLocal()),
      () => blockMarks.dispose(),
      () => layerMarks.dispose(),
      () => roster.dispose()
    );

    this.#peerBrushes = world
      .createActor("peer-brushes")
      .addComponentAndGet(PeerBrushes, {
        room
      });

    this.frustums = world
      .createActor("peer-frustums")
      .addComponentAndGet(PeerFrustums, {
        room,
        camera: options.camera
      });
  }

  publishCursor(
    cursor: BrushCursor | null
  ): void {
    this.#peerBrushes.publishLocalCursor(cursor);
  }

  dispose(): void {
    for (const dispose of this.#disposables.splice(0)) {
      dispose();
    }
  }
}

function readBlockId(
  value: unknown
): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function readLayerKey(
  value: unknown
): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
