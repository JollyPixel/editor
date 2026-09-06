// Import Third-party Dependencies
import type { VoxelWorld } from "@jolly-pixel/voxel.renderer";
import type { TreeNode } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { LayerSelection } from "../../app/state/index.ts";

// CONSTANTS
const kVoxelPrefix = "voxel:";
const kObjectLayerPrefix = "object:";
const kObjectPrefix = "obj:";

export type LayerRef =
  | { kind: "voxel-layer"; name: string; }
  | { kind: "object-layer"; name: string; }
  | { kind: "object"; layerName: string; objectId: string; };

export function layerRowId(
  ref: LayerRef
): string {
  switch (ref.kind) {
    case "voxel-layer":
      return `${kVoxelPrefix}${ref.name}`;
    case "object-layer":
      return `${kObjectLayerPrefix}${ref.name}`;
    default:
      return `${kObjectPrefix}${ref.layerName}/${ref.objectId}`;
  }
}

export function layerRefOf(
  id: string
): LayerRef {
  if (id.startsWith(kObjectPrefix)) {
    const rest = id.slice(kObjectPrefix.length);
    const separator = rest.lastIndexOf("/");

    return {
      kind: "object",
      layerName: rest.slice(0, separator),
      objectId: rest.slice(separator + 1)
    };
  }

  return id.startsWith(kObjectLayerPrefix) ?
    {
      kind: "object-layer",
      name: id.slice(kObjectLayerPrefix.length)
    } :
    {
      kind: "voxel-layer",
      name: id.slice(kVoxelPrefix.length)
    };
}

export function layerSelectionOf(
  ref: LayerRef
): LayerSelection {
  return ref.kind === "object" ?
    {
      kind: "object",
      layerName: ref.layerName,
      objectId: ref.objectId
    } :
    {
      kind: ref.kind,
      name: ref.name
    };
}

export function layerTreeNodes(
  world: VoxelWorld
): TreeNode<LayerRef>[] {
  return [
    ...world.getLayers().map((layer): TreeNode<LayerRef> => {
      const ref: LayerRef = {
        kind: "voxel-layer",
        name: layer.name
      };

      return {
        id: layerRowId(ref),
        label: layer.name,
        icon: "voxel-layer",
        visible: layer.visible,
        data: ref
      };
    }),
    ...world.getObjectLayers().map((layer): TreeNode<LayerRef> => {
      const ref: LayerRef = {
        kind: "object-layer",
        name: layer.name
      };

      return {
        id: layerRowId(ref),
        label: layer.name,
        icon: "object-layer",
        visible: layer.visible,
        data: ref,
        children: layer.objects.map((object): TreeNode<LayerRef> => {
          const objectRef: LayerRef = {
            kind: "object",
            layerName: layer.name,
            objectId: object.id
          };

          return {
            id: layerRowId(objectRef),
            label: object.name,
            icon: "object-area",
            visible: object.visible,
            locked: object.locked ?? false,
            renamable: true,
            data: objectRef
          };
        })
      };
    })
  ];
}
