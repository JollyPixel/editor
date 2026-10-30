// Import Third-party Dependencies
import type { Box3 } from "three";
import type { VoxelWorld } from "@jolly-pixel/voxel.renderer";
import { VoxelMapAnchorKey } from "@jolly-pixel/voxel.renderer/engine";

// Import Internal Dependencies
import {
  ObjectRef,
  VoxelLayerRef,
  type LayerRef,
  type SelectionStore
} from "../../state/index.ts";
import type { MapLayers } from "./MapLayers.ts";

export interface AnchorRevealOptions {
  world: VoxelWorld;
  selection: Pick<SelectionStore, "current">;
  layers: Pick<MapLayers, "bounds">;
  frame(bounds: Box3): void;
}

export function revealAnchor(
  options: AnchorRevealOptions,
  key: string
): void {
  const anchor = VoxelMapAnchorKey.parse(key);
  const ref = anchor === null ? null : anchorRef(options.world, anchor);
  if (ref === null) {
    return;
  }

  options.selection.current = ref;
  const bounds = options.layers.bounds(ref);
  if (bounds !== null) {
    options.frame(bounds);
  }
}

function anchorRef(
  world: VoxelWorld,
  anchor: VoxelMapAnchorKey
): LayerRef | null {
  if (anchor.kind === "layer") {
    const layer = world.getLayerById(anchor.id);

    return layer === undefined ? null : new VoxelLayerRef(layer.name);
  }

  for (const objectLayer of world.objectLayers) {
    if (objectLayer.objects.some(({ id }) => id === anchor.id)) {
      return new ObjectRef(objectLayer.name, anchor.id);
    }
  }

  return null;
}
