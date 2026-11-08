// Import Third-party Dependencies
import { PeerMarkTracker } from "@jolly-pixel/ui/network";
import type { VoxelMapRoom } from "@jolly-pixel/asset.voxel-map/client";

// Import Internal Dependencies
import type {
  PresenceStore,
  SelectionStore
} from "../../../state/index.ts";

// CONSTANTS
const kPresenceKey = "layer";

export interface LayerPresenceOptions {
  room: VoxelMapRoom;
  selection: SelectionStore;
  presence: Pick<PresenceStore, "layerSelections">;
}

export function trackLayerPresence(
  options: LayerPresenceOptions
): () => void {
  const { room, selection, presence } = options;

  const marks = new PeerMarkTracker({
    room,
    presenceKey: kPresenceKey,
    decode: decodeLayerKey,
    local: {
      read: () => selection.current?.key ?? null,
      subscribe: (listener) => selection.subscribe("change", listener)
    },
    publish: (selections) => {
      presence.layerSelections = selections;
    }
  });

  return () => marks.dispose();
}

function decodeLayerKey(
  value: unknown
): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
