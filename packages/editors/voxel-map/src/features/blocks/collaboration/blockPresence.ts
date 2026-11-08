// Import Third-party Dependencies
import { PeerMarkTracker } from "@jolly-pixel/ui/network";
import type { VoxelMapRoom } from "@jolly-pixel/asset.voxel-map/client";

// Import Internal Dependencies
import type {
  BlockSelection,
  PresenceStore
} from "../../../state/index.ts";

// CONSTANTS
const kPresenceKey = "block";

export interface BlockPresenceOptions {
  room: VoxelMapRoom;
  block: BlockSelection;
  presence: Pick<PresenceStore, "blockSelections">;
}

export function trackBlockPresence(
  options: BlockPresenceOptions
): () => void {
  const { room, block, presence } = options;

  const marks = new PeerMarkTracker({
    room,
    presenceKey: kPresenceKey,
    decode: decodeBlockId,
    local: {
      read: () => block.id,
      subscribe: (listener) => block.subscribe("change", listener)
    },
    publish: (selections) => {
      presence.blockSelections = selections;
    }
  });

  return () => marks.dispose();
}

function decodeBlockId(
  value: unknown
): number | undefined {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}
