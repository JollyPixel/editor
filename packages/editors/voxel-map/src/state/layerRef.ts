// CONSTANTS
const kVoxelLayerPrefix = "voxel:";
const kObjectLayerPrefix = "object:";
const kObjectPrefix = "obj:";

export interface ObjectRef {
  layerName: string;
  objectId: string;
}

export type LayerRef =
  | { kind: "voxel-layer"; name: string; }
  | { kind: "object-layer"; name: string; }
  | ({ kind: "object"; } & ObjectRef);

export function layerKey(
  ref: LayerRef
): string {
  switch (ref.kind) {
    case "voxel-layer":
      return `${kVoxelLayerPrefix}${ref.name}`;
    case "object-layer":
      return `${kObjectLayerPrefix}${ref.name}`;
    default:
      return objectKey(ref);
  }
}

export function objectKey(
  ref: ObjectRef
): string {
  return `${kObjectPrefix}${ref.layerName}/${ref.objectId}`;
}

export function parseLayerKey(
  key: string
): LayerRef {
  if (key.startsWith(kObjectPrefix)) {
    const rest = key.slice(kObjectPrefix.length);
    const separator = rest.lastIndexOf("/");

    return {
      kind: "object",
      layerName: rest.slice(0, separator),
      objectId: rest.slice(separator + 1)
    };
  }

  return key.startsWith(kObjectLayerPrefix) ?
    {
      kind: "object-layer",
      name: key.slice(kObjectLayerPrefix.length)
    } :
    {
      kind: "voxel-layer",
      name: key.slice(kVoxelLayerPrefix.length)
    };
}
