// Import Internal Dependencies
import { VoxelLayerRef } from "./VoxelLayerRef.ts";
import { ObjectLayerRef } from "./ObjectLayerRef.ts";
import { ObjectRef } from "./ObjectRef.ts";

export type LayerDropPosition = "above" | "below" | "inside";

export type LayerRef =
  | VoxelLayerRef
  | ObjectLayerRef
  | ObjectRef;

export function parseLayerRef(
  key: string
): LayerRef {
  if (key.startsWith(ObjectRef.PREFIX)) {
    const rest = key.slice(ObjectRef.PREFIX.length);
    const separator = rest.lastIndexOf("/");

    return new ObjectRef(
      rest.slice(0, separator),
      rest.slice(separator + 1)
    );
  }

  return key.startsWith(ObjectLayerRef.PREFIX) ?
    new ObjectLayerRef(key.slice(ObjectLayerRef.PREFIX.length)) :
    new VoxelLayerRef(key.slice(VoxelLayerRef.PREFIX.length));
}
