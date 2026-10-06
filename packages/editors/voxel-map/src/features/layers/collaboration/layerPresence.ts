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
    localKey: () => selection.current?.key ?? null,
    readKey: readLayerKey,
    publish: (selections) => {
      presence.layerSelections = selections;
    }
  });
  const unsubscribe = selection.subscribe("change", () => marks.publishLocal());

  return () => {
    unsubscribe();
    marks.dispose();
  };
}

function readLayerKey(
  value: unknown
): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
