// Import Third-party Dependencies
import type { VoxelWorld } from "@jolly-pixel/voxel.renderer";
import type {
  TreeBadge,
  TreeNode
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  ObjectLayerRef,
  ObjectRef,
  VoxelLayerRef,
  type LayerRef
} from "../../state/index.ts";
import type { LayerVisibilityStore } from "./LayerVisibilityStore.ts";
import type { PeerMarks } from "../../shared/PeerMarks.ts";
import { formatCount } from "../../shared/format.ts";

// CONSTANTS
const kMaxBadges = 3;

export function layerSelectionsOf(
  world: VoxelWorld
): LayerRef[] {
  return [
    ...world.getLayers().map((layer) => new VoxelLayerRef(layer.name)),
    ...world.objectLayers.toArray().flatMap((layer): LayerRef[] => [
      new ObjectLayerRef(layer.name),
      ...layer.objects.map((object) => new ObjectRef(layer.name, object.id))
    ])
  ];
}

export function layerTreeNodes(
  world: VoxelWorld,
  visibility: Pick<LayerVisibilityStore, "resolve">
): TreeNode<LayerRef>[] {
  return [
    ...world.getLayers().map((layer): TreeNode<LayerRef> => {
      const ref = new VoxelLayerRef(layer.name);
      const id = ref.key;

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
      const ref = new ObjectLayerRef(layer.name);
      const id = ref.key;

      return {
        id,
        label: layer.name,
        icon: "object-layer",
        visible: visibility.resolve(id, layer.visible),
        data: ref,
        children: layer.objects.map((object): TreeNode<LayerRef> => {
          const objectRef = new ObjectRef(layer.name, object.id);
          const objectId = objectRef.key;

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
  marks: PeerMarks<string>
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
  marks: PeerMarks<string>
): TreeBadge[] {
  if (node.data === undefined) {
    return [];
  }

  const peers = marks.marksOf(node.data.key);

  return peers.slice(0, kMaxBadges).map((peer) => {
    return {
      color: peer.color,
      title: peer.displayName
    };
  });
}
