// Import Third-party Dependencies
import {
  BlockTransform,
  type BlockTransformJSON
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import { TransformLiveSync } from "#src/features/transform/collaboration/TransformLiveSync.ts";
import type { ModelBlock } from "#src/scene/blocks/index.ts";
import { createRoomHarness } from "../../../collaboration/roomHarness.ts";
import { createModelFixture } from "../../../fixtures/model.ts";

// CONSTANTS
export const WAVE = "wave";
export const RUN = "run";
const kShown: BlockTransformJSON = {
  position: { x: 0, y: 0, z: 0 },
  pivotOffset: { x: 0, y: 0, z: 0 },
  size: { x: 1, y: 1, z: 1 },
  scale: { x: 1, y: 1, z: 1 },
  rotation: { x: 0, y: 0, z: 0 }
};

export function createView() {
  const listeners = new Set<() => void>();
  const view = {
    shown: null as string | null,
    key: () => view.shown,
    shownTransform: () => kShown,
    subscribe: (listener: () => void) => {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
    show: (key: string | null) => {
      view.shown = key;
      for (const listener of listeners) {
        listener();
      }
    }
  };

  return view;
}

export function createLiveSyncHarness(
  view = createView()
) {
  const room = createRoomHarness();
  room.addPeer("bob");
  const { blocks, addBlock } = createModelFixture();
  const frames = { requested: 0 };
  const sync = new TransformLiveSync({
    room: room.room,
    blocks,
    view,
    requestFrame: () => frames.requested++
  });

  return {
    ...room,
    blocks,
    addBlock,
    sync,
    view,
    frames
  };
}

export type LiveSyncHarness = ReturnType<typeof createLiveSyncHarness>;

export function publishLive(
  harness: LiveSyncHarness,
  uuid: string,
  x: number,
  view: string | null = null
): void {
  harness.emit("peer-presence", {
    clientId: "bob",
    patch: {
      transformLive: {
        uuid,
        transform: { ...kShown, position: { x, y: 0, z: 0 } },
        view
      }
    }
  });
}

export function clearLive(
  harness: LiveSyncHarness
): void {
  harness.emit("peer-presence", {
    clientId: "bob",
    patch: { transformLive: null }
  });
}

export function liveX(
  frame: unknown
): number | null {
  if (typeof frame !== "object" || frame === null) {
    return null;
  }

  return BlockTransform.parse(Reflect.get(frame, "transform"))?.position.x ?? null;
}

export function isGlowing(
  block: ModelBlock
): boolean {
  const marker = block.node.children.find((child) => child.name === "pivot_visual");

  return marker?.visible ?? false;
}
