// Import Third-party Dependencies
import type { VoxelWorld } from "@jolly-pixel/voxel.renderer";
import type {
  TreeBadge,
  TreeNode
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type {
  LayerSelection,
  LayerVisibilityStore
} from "../../state/index.ts";
import type { PeerMarkMap } from "../../collaboration/peerMarks.ts";
import { layerRefPresenceKey } from "./collaboration/layerPresenceKey.ts";
import { formatCount } from "../blocks/blockUsage.ts";

// CONSTANTS
const kVoxelPrefix = "voxel:";
const kObjectLayerPrefix = "object:";
const kObjectPrefix = "obj:";
const kMaxBadges = 3;

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

export function layerSelectionsOf(
  world: VoxelWorld
): LayerSelection[] {
  return [
    ...world.getLayers().map((layer): LayerSelection => {
      return {
        kind: "voxel-layer",
        name: layer.name
      };
    }),
    ...world.objectLayers.toArray().flatMap((layer): LayerSelection[] => [
      {
        kind: "object-layer",
        name: layer.name
      },
      ...layer.objects.map((object): LayerSelection => {
        return {
          kind: "object",
          layerName: layer.name,
          objectId: object.id
        };
      })
    ])
  ];
}

export function layerTreeNodes(
  world: VoxelWorld,
  visibility: Pick<LayerVisibilityStore, "resolve">
): TreeNode<LayerRef>[] {
  return [
    ...world.getLayers().map((layer): TreeNode<LayerRef> => {
      const ref: LayerRef = {
        kind: "voxel-layer",
        name: layer.name
      };
      const id = layerRowId(ref);

      return {
        id,
        label: layer.name,
        icon: "voxel-layer",
        detail: formatCount(layer.voxelCount, "voxel"),
        visible: visibility.resolve(id, layer.visible),
        data: ref
      };
    }),
    ...world.objectLayers.toArray().map((layer): TreeNode<LayerRef> => {
      const ref: LayerRef = {
        kind: "object-layer",
        name: layer.name
      };
      const id = layerRowId(ref);

      return {
        id,
        label: layer.name,
        icon: "object-layer",
        visible: visibility.resolve(id, layer.visible),
        data: ref,
        children: layer.objects.map((object): TreeNode<LayerRef> => {
          const objectRef: LayerRef = {
            kind: "object",
            layerName: layer.name,
            objectId: object.id
          };
          const objectId = layerRowId(objectRef);

          return {
            id: objectId,
            label: object.name,
            icon: "object-area",
            visible: visibility.resolve(objectId, object.visible),
            locked: object.locked ?? false,
            renamable: true,
            data: objectRef
          };
        })
      };
    })
  ];
}

export function withLayerBadges(
  nodes: readonly TreeNode<LayerRef>[],
  marks: PeerMarkMap<string>
): TreeNode<LayerRef>[] {
  return nodes.map((node) => {
    const badges = badgesOf(node, marks);
    const children = node.children === undefined
      ? undefined
      : withLayerBadges(node.children, marks);

    return {
      ...node,
      ...badges.length > 0 ? { badges } : {},
      ...children === undefined ? {} : { children }
    };
  });
}

function badgesOf(
  node: TreeNode<LayerRef>,
  marks: PeerMarkMap<string>
): TreeBadge[] {
  if (node.data === undefined) {
    return [];
  }

  const peers = marks.get(layerRefPresenceKey(node.data)) ?? [];

  return peers.slice(0, kMaxBadges).map((peer) => {
    return {
      color: peer.color,
      title: peer.displayName
    };
  });
}
