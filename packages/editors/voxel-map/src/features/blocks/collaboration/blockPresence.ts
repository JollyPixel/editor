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
    localKey: () => block.id,
    readKey: readBlockId,
    publish: (selections) => {
      presence.blockSelections = selections;
    }
  });
  const unsubscribe = block.subscribe("change", () => marks.publishLocal());

  return () => {
    unsubscribe();
    marks.dispose();
  };
}

function readBlockId(
  value: unknown
): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}
