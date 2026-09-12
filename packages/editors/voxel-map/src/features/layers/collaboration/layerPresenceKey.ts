// Import Internal Dependencies
import type { LayerSelection } from "../../../app/state/index.ts";
import type { LayerRef } from "../layerTree.ts";

export function layerRefPresenceKey(
  ref: LayerRef
): string {
  return ref.kind === "object"
    ? `object:${ref.objectId}`
    : `${ref.kind}:${ref.name}`;
}

export function layerPresenceKey(
  selection: LayerSelection
): string | null {
  return selection === null
    ? null
    : layerRefPresenceKey(selection);
}

export function readLayerPresenceKey(
  value: unknown
): string | null {
  return typeof value === "string" && value.length > 0
    ? value
    : null;
}
